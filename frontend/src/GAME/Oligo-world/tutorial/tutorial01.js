export const TUTORIAL_MOVE_TARGET = 4
export const TUTORIAL_REWARD = { exp: 10, currencyW: 10 }

export function createTutorial01() {
  return { stage: 'greeting', validMoves: 0, rewardGranted: false }
}

export function advanceTutorial(tutorial) {
  if (tutorial.stage === 'greeting') return { ...tutorial, stage: 'movementIntro' }
  if (tutorial.stage === 'movementIntro') return { ...tutorial, stage: 'moving' }
  if (tutorial.stage === 'doorIntro') return { ...tutorial, stage: 'toDoor' }
  return tutorial
}

export function recordTutorialMove(tutorial) {
  if (tutorial.stage !== 'moving') return tutorial
  const validMoves = Math.min(TUTORIAL_MOVE_TARGET, tutorial.validMoves + 1)
  return { ...tutorial, validMoves,
    stage: validMoves === TUTORIAL_MOVE_TARGET ? 'doorIntro' : 'moving' }
}

export function tutorialDialogue(stage) {
  if (stage === 'greeting') return '좋아, 오늘은 집 밖으로 첫 걸음을 내디뎌 볼까?'
  if (stage === 'movementIntro') return '방향키로 방 안을 네 걸음 움직여 봐!'
  if (stage === 'doorIntro') return '잘했어! 이제 왼쪽 현관문으로 가 보자.'
  return null
}
