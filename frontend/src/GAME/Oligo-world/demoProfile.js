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
    finalize: data => update({ ...data, profile_status: 'ACTIVE', level: 1, exp: 0,
      currency_w: 0, current_map_id: 'map001', position_x: 5, position_y: 3,
      tutorial_stage: 'greeting', tutorial_valid_moves: 0, tutorial_reward_granted: false }),
    saveProgress: update,
    completeTutorial: () => update({ exp: 10, currency_w: 10, current_map_id: 'map002',
      position_x: 6, position_y: 5, tutorial_stage: 'complete', tutorial_reward_granted: true }),
  }
}
