import { useState } from 'react'
import { Building2, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { useRegionCatalog } from '../features/regions/useRegionCatalog'
import '../App.css'
import './Signup.css'
import nightLogo from '../assets/logo5.png'
import dayLogo from '../assets/logo6.png'

const SECURITY_QUESTIONS = [
  '내가 졸업한 초등학교는?',
  '나의 첫사랑 이름은?',
  '나의 애완동물 이름은?',
  '나의 첫 직장명은?',
]
const CUSTOM_SECURITY_QUESTION = 'custom'
const VISIBLE_ASCII_PATTERN = /^[!-~]+$/
const INITIAL_FORM = {
  userId: '', password: '', passwordConfirm: '', phone: '', email: '', sidoCode: '', regionCode: '',
  securityQuestionType: '', customSecurityQuestion: '', securityAnswer: '',
}

function isValidAccountText(value, minLength, maxLength) {
  return value.length >= minLength && value.length <= maxLength && VISIBLE_ASCII_PATTERN.test(value)
}

function validate(formData) {
  const nextErrors = {}
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!formData.userId.trim()) nextErrors.userId = '사용할 아이디를 입력해주세요.'
  else if (!isValidAccountText(formData.userId, 6, 12)) {
    nextErrors.userId = '아이디는 6~12자의 영문, 숫자, 특수문자로 입력해주세요.'
  }
  if (!formData.password) nextErrors.password = '비밀번호를 입력해주세요.'
  else if (!isValidAccountText(formData.password, 4, 12)) {
    nextErrors.password = '비밀번호는 4~12자의 영문, 숫자, 특수문자로 입력해주세요.'
  }
  if (!formData.passwordConfirm) nextErrors.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
  else if (formData.password !== formData.passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  if (!formData.email.trim()) nextErrors.email = '이메일을 입력해주세요.'
  else if (!emailPattern.test(formData.email.trim())) nextErrors.email = '올바른 이메일 형식으로 입력해주세요.'
  if (!formData.sidoCode) nextErrors.municipality = '시/도를 선택해주세요.'
  else if (!formData.regionCode) nextErrors.municipality = '시/군/구를 선택해주세요.'
  if (!formData.securityQuestionType) nextErrors.securityQuestionType = '힌트 질문을 선택해주세요.'
  if (formData.securityQuestionType === CUSTOM_SECURITY_QUESTION) {
    const customQuestion = formData.customSecurityQuestion.trim()
    if (!customQuestion) nextErrors.customSecurityQuestion = '힌트 질문을 입력해주세요.'
    else if (customQuestion.length > 20) nextErrors.customSecurityQuestion = '힌트 질문은 20자 이내로 입력해주세요.'
  }
  if (!formData.securityAnswer.trim()) nextErrors.securityAnswer = '힌트 답변을 입력해주세요.'
  return nextErrors
}

function moveTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

export default function Signup() {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [isValidated, setIsValidated] = useState(false)
  const { sidoOptions, sidoStatus, sigunguOptions, sigunguStatus } = useRegionCatalog(formData.sidoCode)

  const handleChange = ({ target: { name, value } }) => {
    setFormData((current) => {
      if (name === 'sidoCode') return { ...current, sidoCode: value, regionCode: '' }
      if (name === 'securityQuestionType') return { ...current, securityQuestionType: value, customSecurityQuestion: '' }
      return { ...current, [name]: value }
    })
    setErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[name]
      if (name === 'sidoCode' || name === 'regionCode') delete nextErrors.municipality
      if (name === 'password') delete nextErrors.passwordConfirm
      if (name === 'securityQuestionType') delete nextErrors.customSecurityQuestion
      return nextErrors
    })
    setIsValidated(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate(formData)
    setErrors(nextErrors)
    setIsValidated(false)
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.keys(nextErrors)[0]
      const fieldId = firstError === 'municipality' && !formData.sidoCode ? 'province' : firstError
      document.getElementById(fieldId)?.focus()
      return
    }
    setIsValidated(true)
  }

  return (
    <main className="signup-page">
      <header className="signup-header account-header">
        <div className="account-header-inner">
          <a className="signup-logo-link account-header-logo" href="/" onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            moveTo('/')
          }} aria-label="OLIGO-K 홈으로 이동">
            <img className="signup-logo account-logo theme-logo theme-logo--night" src={nightLogo} alt="OLIGO-K" />
            <img className="signup-logo account-logo theme-logo theme-logo--day" src={dayLogo} alt="OLIGO-K" />
          </a>
        </div>
      </header>
      <section className="signup-content" aria-labelledby="signup-title">
        <div className="signup-card">
          <div className="signup-card-heading">
            <h1 id="signup-title">회원가입</h1>
            <p>OLIGO-K와 함께 지역의 가능성을 올려보세요!</p>
          </div>
          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            <div className="signup-field">
              <label htmlFor="userId"><UserRound size={17} />사용할 아이디 <b>필수</b></label>
              <span className="signup-help" id="userId-help">6~12자 / 영문·숫자·특수문자 사용 가능</span>
              <input id="userId" name="userId" type="text" autoComplete="username" value={formData.userId}
                onChange={handleChange} minLength={6} maxLength={12} required placeholder="사용할 아이디를 입력해주세요"
                aria-invalid={Boolean(errors.userId)}
                aria-describedby={errors.userId ? 'userId-help userId-error' : 'userId-help'} />
              {errors.userId && <small className="signup-error" id="userId-error" role="alert">{errors.userId}</small>}
            </div>
            <div className="signup-password-grid">
              <SignupPasswordField id="password" label="비밀번호" value={formData.password} error={errors.password}
                placeholder="비밀번호를 입력해주세요" onChange={handleChange} />
              <SignupPasswordField id="passwordConfirm" label="비밀번호 확인" value={formData.passwordConfirm}
                error={errors.passwordConfirm} placeholder="비밀번호를 다시 입력해주세요" onChange={handleChange} />
            </div>
            <div className="signup-contact-grid">
              <div className="signup-field">
                <label htmlFor="phone"><Phone size={17} />전화번호 <em>선택</em></label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" value={formData.phone}
                  onChange={handleChange} placeholder="010-1234-5678" />
              </div>
              <div className="signup-field">
                <label htmlFor="email"><Mail size={17} />이메일 <b>필수</b></label>
                <span className="signup-help" id="email-help">사업보고서를 받아보실 이메일 주소</span>
                <input id="email" name="email" type="email" autoComplete="email" value={formData.email}
                  onChange={handleChange} placeholder="example@email.com" required aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-help email-error' : 'email-help'} />
                {errors.email && <small className="signup-error" id="email-error" role="alert">{errors.email}</small>}
              </div>
            </div>
            <fieldset className="signup-fieldset">
              <legend><Building2 size={17} />소속 지자체 또는 관심지역<b>필수</b></legend>
              <div className="signup-select-grid">
                <label className="signup-sr-only" htmlFor="province">시/도 선택</label>
                <select id="province" name="sidoCode" value={formData.sidoCode} onChange={handleChange} required
                  disabled={sidoStatus !== 'ready'}
                  aria-invalid={Boolean(errors.municipality)} aria-describedby={errors.municipality ? 'municipality-error' : undefined}>
                  <option value="">시/도 선택</option>
                  {sidoOptions.map((sido) => (
                    <option value={sido.sidoCode} key={sido.sidoCode}>{sido.sidoName}</option>
                  ))}
                </select>
                <label className="signup-sr-only" htmlFor="municipality">시/군/구 선택</label>
                <select id="municipality" name="regionCode" value={formData.regionCode} onChange={handleChange}
                  disabled={!formData.sidoCode || sigunguStatus !== 'ready'} required
                  aria-invalid={Boolean(errors.municipality)}
                  aria-describedby={errors.municipality ? 'municipality-error' : undefined}>
                  <option value="">시/군/구 선택</option>
                  {sigunguOptions.map((region) => (
                    <option value={region.regionCode} key={region.regionCode}>{region.sigunguName}</option>
                  ))}
                </select>
              </div>
              {sidoStatus === 'error' && <small className="signup-error" role="alert">시/도 목록을 불러오지 못했습니다. 다시 열어주세요.</small>}
              {sidoStatus === 'empty' && <small className="signup-error" role="alert">선택 가능한 시/도가 없습니다.</small>}
              {sigunguStatus === 'error' && <small className="signup-error" role="alert">시/군/구 목록을 불러오지 못했습니다. 다시 선택해주세요.</small>}
              {sigunguStatus === 'empty' && <small className="signup-error" role="alert">선택 가능한 시/군/구가 없습니다.</small>}
              {errors.municipality && <small className="signup-error" id="municipality-error" role="alert">{errors.municipality}</small>}
            </fieldset>
            <fieldset className="signup-fieldset">
              <legend><LockKeyhole size={17} />비밀번호 찾기 힌트 질문 <b>필수</b></legend>
              <div className="signup-security-fields">
                <div className="signup-field">
                  <label htmlFor="securityQuestionType">힌트 질문</label>
                  <select id="securityQuestionType" name="securityQuestionType" value={formData.securityQuestionType}
                    onChange={handleChange} required aria-invalid={Boolean(errors.securityQuestionType)}
                    aria-describedby={errors.securityQuestionType ? 'securityQuestionType-error' : undefined}>
                    <option value="">질문을 선택해주세요</option>
                    {SECURITY_QUESTIONS.map((question) => <option value={question} key={question}>{question}</option>)}
                    <option value={CUSTOM_SECURITY_QUESTION}>직접입력</option>
                  </select>
                  {errors.securityQuestionType && <small className="signup-error" id="securityQuestionType-error" role="alert">
                    {errors.securityQuestionType}
                  </small>}
                </div>
                {formData.securityQuestionType === CUSTOM_SECURITY_QUESTION && <div className="signup-field">
                  <label htmlFor="customSecurityQuestion">직접 질문</label>
                  <input id="customSecurityQuestion" name="customSecurityQuestion" type="text"
                    value={formData.customSecurityQuestion} onChange={handleChange} placeholder="20자 이내로 작성해주세요 :)"
                    maxLength={20} required aria-invalid={Boolean(errors.customSecurityQuestion)}
                    aria-describedby={errors.customSecurityQuestion ? 'customSecurityQuestion-error' : undefined} />
                  {errors.customSecurityQuestion && <small className="signup-error" id="customSecurityQuestion-error" role="alert">
                    {errors.customSecurityQuestion}
                  </small>}
                </div>}
                <div className="signup-field">
                  <label htmlFor="securityAnswer">힌트 답변</label>
                  <input id="securityAnswer" name="securityAnswer" type="text" value={formData.securityAnswer}
                    onChange={handleChange} placeholder="답변을 입력해주세요" required aria-invalid={Boolean(errors.securityAnswer)}
                    aria-describedby={errors.securityAnswer ? 'securityAnswer-error' : undefined} />
                  {errors.securityAnswer && <small className="signup-error" id="securityAnswer-error" role="alert">
                    {errors.securityAnswer}
                  </small>}
                </div>
              </div>
            </fieldset>
            <button className="signup-submit" type="submit">회원가입</button>
            {isValidated && <p className="signup-success" role="status">
              입력 확인이 완료되었습니다. 회원가입 API 연결 후 처리됩니다.
            </p>}
            <p className="signup-login-prompt">이미 계정이 있으신가요? <a href="/login" onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              moveTo('/login')
            }}>로그인</a></p>
          </form>
        </div>
      </section>
    </main>
  )
}

function SignupPasswordField({ id, label, value, error, placeholder, onChange }) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  return <div className="signup-field">
    <label htmlFor={id}><LockKeyhole size={17} />{label} <b>필수</b></label>
    <span className="signup-help" id={helpId}>4~12자 / 영문·숫자·특수문자 사용 가능</span>
    <input id={id} name={id} type="password" autoComplete="new-password" value={value} onChange={onChange}
      minLength={4} maxLength={12} placeholder={placeholder} required aria-invalid={Boolean(error)}
      aria-describedby={error ? `${helpId} ${errorId}` : helpId} />
    {error && <small className="signup-error" id={errorId} role="alert">{error}</small>}
  </div>
}
