// Temporary game preview only. This grants no member or administrator API access.
export function acceptsDemoLogin(username, password) {
  return username === 'admin' && password === '1234'
}

export function createDemoProfileApi() {
  let profile = null
  const update = async data => {
    profile = { ...profile, ...data }
    return { ...profile }
  }
  return {
    load: async () => profile,
    saveDraft: data => update({ profile_status: 'DRAFT', ...data }),
    finalize: async data => {
      profile = { ...data, profile_status: 'ACTIVE' }
      return profile
    },
  }
}
