import { requiredExpForLevel } from '../player/experience'

export default function GameHud({ character, player, map, nickname }) {
  return (
    <div className="oligo-world-hud" aria-label="게임 상태">
      <div className="oligo-world-hud-hero">
        <strong>{nickname || character.name}</strong><span>LV.{player.level}</span>
      </div>
      <div className="oligo-world-hud-exp">EXP {player.exp} / {requiredExpForLevel(player.level)}</div>
      <div className="oligo-world-hud-money">W {player.currencyW}</div>
      <div className="oligo-world-hud-map">{map.name}</div>
    </div>
  )
}
