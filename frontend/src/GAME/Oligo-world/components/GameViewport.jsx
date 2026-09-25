import CharacterSprite from './CharacterSprite'

const tileNames = {
  '#': 'wall', '.': 'floor', b: 'bed', t: 'table', s: 'shelf', D: 'door',
  P: 'pine', R: 'rock', H: 'house',
}

export default function GameViewport({ map, player, character, viewportRef }) {
  return (
    <div className={`oligo-world-viewport oligo-world-viewport--${map.type}`}
      ref={viewportRef} tabIndex={0} aria-label={`${map.name} 게임 화면`}>
      <div className="oligo-world-scene-heading">
        <span>{map.id.toUpperCase()}</span><strong>{map.name}</strong>
      </div>
      <div className="oligo-world-map-frame">
        <div className="oligo-world-map oligo-world-map--illustrated"
          style={{ '--oligo-columns': map.width,
          '--oligo-rows': map.height, '--oligo-x': player.position.x,
          '--oligo-y': player.position.y, backgroundImage: `url("${map.background}")` }} role="img"
          aria-label={`${map.name}: 캐릭터 위치 ${player.position.x + 1}열 ${player.position.y + 1}행`}>
          {map.tiles.flatMap((row, y) => [...row].map((tile, x) => (
            <div className={`oligo-world-tile oligo-world-tile--${tileNames[tile]}`}
              key={`${x}-${y}`} aria-hidden="true">{tile === 'D' ? '출구' : ''}</div>
          )))}
          <div className="oligo-world-player" aria-hidden="true">
            <CharacterSprite character={character} />
          </div>
        </div>
      </div>
      <p className="oligo-world-controls">{map.id === 'map001'
        ? '방향키로 이동 · 빛나는 문이 출구입니다' : '방향키로 숲길을 둘러보세요'}</p>
    </div>
  )
}
