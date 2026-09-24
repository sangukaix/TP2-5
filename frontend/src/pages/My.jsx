import { useEffect, useState } from 'react'
import { findRegionByCode } from '../features/regions/regionCatalog'
import { useRegionCatalog } from '../features/regions/useRegionCatalog'
import { useAuth } from '../features/auth/useAuth'
import { authApi } from '../api/authApi'
import {
  Building2, CalendarDays, FileText, KeyRound, LockKeyhole, LogOut, Mail, MapPinned,
  Phone, ShieldCheck, Trash2, Upload, UserRound,
} from 'lucide-react'
import '../App.css'
import './My.css'
import logo from '../assets/logo5.png'
import dayLogo from '../assets/logo6.png'

const SECURITY_QUESTIONS = [
  '내가 졸업한 초등학교는?',
  '나의 첫사랑 이름은?',
  '나의 애완동물 이름은?',
  '나의 첫 직장명은?',
]

const CUSTOM_QUESTION = 'custom'
const VISIBLE_ASCII_PATTERN = /^[!-~]+$/

const INITIAL_PROFILE = {
  userId: '',
  name: '',
  email: '',
  phone: '',
  regionCode: '',
}

const INITIAL_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
}

const INITIAL_HINT_FORM = {
  currentPassword: '',
  securityQuestionType: '',
  customSecurityQuestion: '',
  securityAnswer: '',
}

function isValidPassword(value) {
  return value.length >= 4 && value.length <= 12 && VISIBLE_ASCII_PATTERN.test(value)
}

function moveTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

function handlePageLink(path) {
  return (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    moveTo(path)
  }
}

export default function My() {
  const { user, refreshUser, logout, setUser } = useAuth()
  const [profile, setProfile] = useState(() => user ? {
    userId: user.username, name: user.name || '', email: user.email,
    phone: user.phone || '', regionCode: user.region_code,
  } : INITIAL_PROFILE)
  const [draftSidoCode, setDraftSidoCode] = useState('')
  const selectedSidoCode = profile.regionCode.slice(0, 2) || draftSidoCode
  const { sidoOptions, sidoStatus, sigunguOptions, sigunguStatus } = useRegionCatalog(selectedSidoCode)
  const [isEditingName, setIsEditingName] = useState(!user?.name)
  const [isEditingPhone, setIsEditingPhone] = useState(!user?.phone)
  const [profilePreview, setProfilePreview] = useState('')
  const [securityView, setSecurityView] = useState('')
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM)
  const [passwordErrors, setPasswordErrors] = useState({})
  const [hintForm, setHintForm] = useState(INITIAL_HINT_FORM)
  const [hintErrors, setHintErrors] = useState({})
  const [actionNotice, setActionNotice] = useState('')

  useEffect(() => () => {
    if (profilePreview) URL.revokeObjectURL(profilePreview)
  }, [profilePreview])

  const handleProfileChange = ({ target: { name, value } }) => {
    setProfile((current) => ({ ...current, [name]: value }))
  }

  const handleSidoChange = (event) => {
    setDraftSidoCode(event.target.value)
    setProfile((current) => ({ ...current, regionCode: '' }))
  }

  const handleRegionChange = async (event) => {
    const regionCode = event.target.value
    setProfile((current) => ({ ...current, regionCode }))
    if (!regionCode) return
    try {
      const updated = await authApi.updateProfile({ region_code: regionCode })
      setUser(updated)
      setActionNotice('지역 정보가 저장되었습니다.')
    } catch (error) {
      setProfile((current) => ({ ...current, regionCode: user.region_code }))
      setDraftSidoCode('')
      setActionNotice(error.message)
    }
  }

  const handleProfileImage = (event) => {
    const [file] = event.target.files
    if (!file) return
    setProfilePreview(URL.createObjectURL(file))
    setActionNotice('사진은 이 화면에서만 미리 보입니다. 서버에는 업로드되지 않았습니다.')
  }

  const handleProfileFieldSubmit = async (field, setEditing) => {
    try {
      const updated = await authApi.updateProfile({ [field]: profile[field].trim() || null })
      setUser(updated)
      setEditing(false)
      setActionNotice('회원정보가 저장되었습니다.')
    } catch (error) {
      setActionNotice(error.message)
    }
  }

  const handleProfileFieldToggle = (field, isEditing, setEditing) => {
    if (isEditing) {
      handleProfileFieldSubmit(field, setEditing)
      return
    }
    setEditing(true)
  }

  const handlePasswordChange = ({ target: { name, value } }) => {
    setPasswordForm((current) => ({ ...current, [name]: value }))
    setPasswordErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[name]
      if (name === 'newPassword') delete nextErrors.newPasswordConfirm
      return nextErrors
    })
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!passwordForm.currentPassword) nextErrors.currentPassword = '현재 비밀번호를 입력해주세요.'
    if (!passwordForm.newPassword) nextErrors.newPassword = '새 비밀번호를 입력해주세요.'
    else if (!isValidPassword(passwordForm.newPassword)) {
      nextErrors.newPassword = '4~12자의 영문, 숫자, 특수문자로 입력해주세요.'
    }
    if (!passwordForm.newPasswordConfirm) {
      nextErrors.newPasswordConfirm = '새 비밀번호를 한 번 더 입력해주세요.'
    } else if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      nextErrors.newPasswordConfirm = '새 비밀번호가 일치하지 않습니다.'
    }
    setPasswordErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`my${Object.keys(nextErrors)[0][0].toUpperCase()}${Object.keys(nextErrors)[0].slice(1)}`)?.focus()
      return
    }

    try {
      await authApi.changePassword({ current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword })
      setPasswordForm(INITIAL_PASSWORD_FORM)
      setActionNotice('비밀번호가 변경되었습니다. 다시 로그인해주세요.')
      await refreshUser()
      moveTo('/login')
    } catch (error) {
      setActionNotice(error.message)
    }
  }

  const handleHintChange = ({ target: { name, value } }) => {
    setHintForm((current) => name === 'securityQuestionType'
      ? { ...current, securityQuestionType: value, customSecurityQuestion: '' }
      : { ...current, [name]: value })
    setHintErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[name]
      if (name === 'securityQuestionType') delete nextErrors.customSecurityQuestion
      return nextErrors
    })
  }

  const handleHintSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!hintForm.currentPassword) nextErrors.currentPassword = '현재 비밀번호를 입력해주세요.'
    if (!hintForm.securityQuestionType) nextErrors.securityQuestionType = '새 힌트 질문을 선택해주세요.'
    if (hintForm.securityQuestionType === CUSTOM_QUESTION && !hintForm.customSecurityQuestion.trim()) {
      nextErrors.customSecurityQuestion = '새 힌트 질문을 입력해주세요.'
    }
    if (!hintForm.securityAnswer.trim()) nextErrors.securityAnswer = '새 힌트 답변을 입력해주세요.'
    setHintErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const fieldIds = {
        currentPassword: 'myHintCurrentPassword',
        securityQuestionType: 'mySecurityQuestionType',
        customSecurityQuestion: 'myCustomSecurityQuestion',
        securityAnswer: 'mySecurityAnswer',
      }
      document.getElementById(fieldIds[Object.keys(nextErrors)[0]])?.focus()
      return
    }

    try {
      await authApi.changeHint({ current_password: hintForm.currentPassword,
        hint_question: hintForm.securityQuestionType === CUSTOM_QUESTION
          ? hintForm.customSecurityQuestion.trim() : hintForm.securityQuestionType,
        hint_answer: hintForm.securityAnswer.trim() })
      setHintForm(INITIAL_HINT_FORM)
      await refreshUser()
      setActionNotice('힌트 질문이 변경되었습니다.')
    } catch (error) {
      setActionNotice(error.message)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      moveTo('/')
    } catch (error) {
      setActionNotice(error.message)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('회원 계정을 탈퇴하시겠습니까?')) return
    try {
      await authApi.deleteAccount()
      setUser(null)
      moveTo('/')
    } catch (error) {
      setActionNotice(error.message)
    }
  }

  const profileName = profile.name.trim() || '이름 정보 없음'
  const profileUserId = profile.userId || '아이디 정보 없음'
  const selectedRegion = findRegionByCode(sigunguOptions, profile.regionCode)
  const profileRegion = selectedRegion?.regionName || (profile.regionCode ? '지역 정보 확인 중' : '소속 정보 없음')

  return (
    <main className="my-page">
      <header className="my-header account-header">
        <div className="account-header-inner">
          <a className="my-logo-link account-header-logo" href="/" onClick={handlePageLink('/')}
            aria-label="OLIGO-K 홈으로 이동">
            <img className="my-logo account-logo theme-logo theme-logo--night" src={logo} alt="OLIGO-K" />
            <img className="my-logo account-logo theme-logo theme-logo--day" src={dayLogo} alt="OLIGO-K" />
          </a>
        </div>
      </header>
      <section className="my-content" aria-labelledby="my-title">
        <div className="my-overview-card">
          <div className="my-page-heading">
            <h1 id="my-title">MY PAGE</h1>
          </div>
          <section className="my-profile-card" aria-labelledby="my-profile-title">
            <div className="my-profile-image">
              {profilePreview
                ? <img src={profilePreview} alt="선택한 프로필 미리보기" />
                : <UserRound size={44} aria-hidden="true" />}
            </div>
            <div className="my-profile-summary">
              <span id="my-profile-title">PROFILE</span>
              <h2>{profileName}</h2>
              <p>{profileUserId}</p>
              <small><MapPinned size={14} />{profileRegion}</small>
            </div>
            <label className="my-upload-button" htmlFor="myProfileImage">
              <Upload size={15} />사진 선택
            </label>
            <input className="my-file-input" id="myProfileImage" type="file" accept="image/*"
              onChange={handleProfileImage} />
          </section>
        </div>
        {actionNotice && <p className="my-pending-notice" role="status">{actionNotice}</p>}

        <div className="my-section-grid">
          <section className="my-section my-basic-section" aria-labelledby="my-basic-title">
            <div className="my-section-heading">
              <div><UserRound size={19} /><h2 id="my-basic-title">기본 정보</h2></div>
              <p>회원정보를 확인하고 변경합니다.</p>
            </div>
            <div className="my-form">
              <div className="my-info-list">
                <div className="my-info-row">
                  <span className="my-info-label">아이디</span>
                  <p className="my-info-value">{profile.userId || '미등록'}</p>
                </div>
                <div className="my-info-row">
                  <span className="my-info-label"><Mail size={15} />이메일</span>
                  <p className="my-info-value">{profile.email || '미등록'}</p>
                </div>
                <div className="my-info-row">
                  <span className="my-info-label">이름 <em>선택</em></span>
                  <div className="my-edit-row">
                    {isEditingName ? (
                      <input id="myName" name="name" type="text" value={profile.name}
                        onChange={handleProfileChange} placeholder="이름을 입력해주세요" />
                    ) : <p className="my-info-value">{profile.name || '미등록'}</p>}
                    <button className="my-inline-action" type="button"
                      onClick={() => handleProfileFieldToggle('name', isEditingName, setIsEditingName)}>
                      {isEditingName ? '입력' : '수정'}
                    </button>
                  </div>
                </div>
                <div className="my-info-row">
                  <span className="my-info-label"><Phone size={15} />전화번호 <em>선택</em></span>
                  <div className="my-edit-row">
                    {isEditingPhone ? (
                      <input id="myPhone" name="phone" type="tel" autoComplete="tel" value={profile.phone}
                        onChange={handleProfileChange} placeholder="010-1234-5678" />
                    ) : <p className="my-info-value">{profile.phone || '미등록'}</p>}
                    <button className="my-inline-action" type="button"
                      onClick={() => handleProfileFieldToggle('phone', isEditingPhone, setIsEditingPhone)}>
                      {isEditingPhone ? '입력' : '수정'}
                    </button>
                  </div>
                </div>
                <div className="my-info-row">
                  <span className="my-info-label"><Building2 size={15} />소속 지자체 또는 관심지역</span>
                  <p className="my-info-value">{profileRegion}</p>
                  <div className="my-two-column">
                    <div>
                      <label className="my-sr-only" htmlFor="mySidoCode">시/도 선택</label>
                      <select id="mySidoCode" value={selectedSidoCode} onChange={handleSidoChange}
                        disabled={sidoStatus !== 'ready'}>
                        <option value="">시/도 선택</option>
                        {sidoOptions.map((sido) => (
                          <option value={sido.sidoCode} key={sido.sidoCode}>{sido.sidoName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="my-sr-only" htmlFor="myRegionCode">시/군/구 선택</label>
                      <select id="myRegionCode" value={profile.regionCode} onChange={handleRegionChange}
                        disabled={!selectedSidoCode || sigunguStatus !== 'ready'}>
                        <option value="">시/군/구 선택</option>
                        {sigunguOptions.map((region) => (
                          <option value={region.regionCode} key={region.regionCode}>{region.sigunguName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {sidoStatus === 'error' && <small className="my-error" role="alert">시/도 목록을 불러오지 못했습니다. 다시 열어주세요.</small>}
                  {sidoStatus === 'empty' && <small className="my-error" role="alert">선택 가능한 시/도가 없습니다.</small>}
                  {sigunguStatus === 'error' && <small className="my-error" role="alert">시/군/구 목록을 불러오지 못했습니다. 다시 선택해주세요.</small>}
                  {sigunguStatus === 'empty' && <small className="my-error" role="alert">선택 가능한 시/군/구가 없습니다.</small>}
                </div>
              </div>
            </div>
          </section>

          <div className="my-side-sections">
            <section className="my-section" aria-labelledby="my-security-title">
              <div className="my-section-heading">
                <div><ShieldCheck size={19} /><h2 id="my-security-title">계정 및 보안</h2></div>
                <p>비밀번호와 힌트 질문을 안전하게 관리합니다.</p>
              </div>
              <div className="my-security-tabs">
                <button type="button" aria-expanded={securityView === 'password'}
                  onClick={() => setSecurityView((current) => current === 'password' ? '' : 'password')}>
                  <LockKeyhole size={16} />비밀번호 변경하기
                </button>
                <button type="button" aria-expanded={securityView === 'hint'}
                  onClick={() => setSecurityView((current) => current === 'hint' ? '' : 'hint')}>
                  <KeyRound size={16} />힌트 질문 변경하기
                </button>
              </div>

              {securityView === 'password' && (
                <form className="my-form my-security-form" onSubmit={handlePasswordSubmit} noValidate>
                  <div className="my-field">
                    <label htmlFor="myCurrentPassword">현재 비밀번호 <b>필수</b></label>
                    <input id="myCurrentPassword" name="currentPassword" type="password"
                      autoComplete="current-password" value={passwordForm.currentPassword}
                      onChange={handlePasswordChange} required aria-invalid={Boolean(passwordErrors.currentPassword)} />
                    {passwordErrors.currentPassword && <small className="my-error" role="alert">{passwordErrors.currentPassword}</small>}
                  </div>
                  <div className="my-field">
                    <label htmlFor="myNewPassword">새 비밀번호 <b>필수</b></label>
                    <small className="my-help">4~12자 / 영문·숫자·특수문자 사용 가능</small>
                    <input id="myNewPassword" name="newPassword" type="password" autoComplete="new-password"
                      minLength={4} maxLength={12} value={passwordForm.newPassword}
                      onChange={handlePasswordChange} required aria-invalid={Boolean(passwordErrors.newPassword)} />
                    {passwordErrors.newPassword && <small className="my-error" role="alert">{passwordErrors.newPassword}</small>}
                  </div>
                  <div className="my-field">
                    <label htmlFor="myNewPasswordConfirm">새 비밀번호 확인 <b>필수</b></label>
                    <input id="myNewPasswordConfirm" name="newPasswordConfirm" type="password"
                      autoComplete="new-password" minLength={4} maxLength={12}
                      value={passwordForm.newPasswordConfirm} onChange={handlePasswordChange} required
                      aria-invalid={Boolean(passwordErrors.newPasswordConfirm)} />
                    {passwordErrors.newPasswordConfirm && <small className="my-error" role="alert">{passwordErrors.newPasswordConfirm}</small>}
                  </div>
                  <button className="my-submit" type="submit">비밀번호 변경</button>
                </form>
              )}

              {securityView === 'hint' && (
                <form className="my-form my-security-form" onSubmit={handleHintSubmit} noValidate>
                  <div className="my-field">
                    <label htmlFor="myHintCurrentPassword">현재 비밀번호 <b>필수</b></label>
                    <input id="myHintCurrentPassword" name="currentPassword" type="password"
                      autoComplete="current-password" value={hintForm.currentPassword}
                      onChange={handleHintChange} required aria-invalid={Boolean(hintErrors.currentPassword)} />
                    {hintErrors.currentPassword && <small className="my-error" role="alert">{hintErrors.currentPassword}</small>}
                  </div>
                  <div className="my-field">
                    <label htmlFor="mySecurityQuestionType">새 힌트 질문 <b>필수</b></label>
                    <select id="mySecurityQuestionType" name="securityQuestionType"
                      value={hintForm.securityQuestionType} onChange={handleHintChange} required
                      aria-invalid={Boolean(hintErrors.securityQuestionType)}>
                      <option value="">질문을 선택해주세요</option>
                      {SECURITY_QUESTIONS.map((question) => (
                        <option value={question} key={question}>{question}</option>
                      ))}
                      <option value={CUSTOM_QUESTION}>직접입력</option>
                    </select>
                    {hintErrors.securityQuestionType && <small className="my-error" role="alert">{hintErrors.securityQuestionType}</small>}
                  </div>
                  {hintForm.securityQuestionType === CUSTOM_QUESTION && (
                    <div className="my-field">
                      <label htmlFor="myCustomSecurityQuestion">직접 질문 <b>필수</b></label>
                      <input id="myCustomSecurityQuestion" name="customSecurityQuestion" type="text"
                        value={hintForm.customSecurityQuestion} onChange={handleHintChange}
                        placeholder="20자 이내로 작성해주세요 :)" maxLength={20} required
                        aria-invalid={Boolean(hintErrors.customSecurityQuestion)} />
                      {hintErrors.customSecurityQuestion && <small className="my-error" role="alert">{hintErrors.customSecurityQuestion}</small>}
                    </div>
                  )}
                  <div className="my-field">
                    <label htmlFor="mySecurityAnswer">새 힌트 답변 <b>필수</b></label>
                    <input id="mySecurityAnswer" name="securityAnswer" type="text"
                      value={hintForm.securityAnswer} onChange={handleHintChange}
                      placeholder="답변을 입력해주세요" required aria-invalid={Boolean(hintErrors.securityAnswer)} />
                    {hintErrors.securityAnswer && <small className="my-error" role="alert">{hintErrors.securityAnswer}</small>}
                  </div>
                  <button className="my-submit" type="submit">힌트 질문 변경</button>
                </form>
              )}
            </section>

            <section className="my-section" aria-labelledby="my-usage-title">
              <div className="my-section-heading">
                <div><FileText size={19} /><h2 id="my-usage-title">OLIGO-K 이용 정보</h2></div>
              </div>
              <div className="my-usage-grid">
                <div><FileText size={18} /><span>저장된 기획안</span><strong>데이터 없음</strong></div>
                <div><MapPinned size={18} /><span>최근 분석지역</span><strong>-</strong></div>
                <div><CalendarDays size={18} /><span>최근 기획안 생성일</span><strong>-</strong></div>
              </div>
              <a className="my-outline-link" href="/saved-plans" onClick={handlePageLink('/saved-plans')}>
                저장된 기획안 보기
              </a>
            </section>
          </div>
        </div>

        <section className="my-account-actions" aria-label="계정 작업">
          <button className="my-logout-button" type="button" onClick={handleLogout}>
            <LogOut size={17} />로그아웃
          </button>
          <button className="my-danger-button" type="button" onClick={handleDeleteAccount}>
            <Trash2 size={15} />회원 탈퇴
          </button>
        </section>
      </section>
    </main>
  )
}
