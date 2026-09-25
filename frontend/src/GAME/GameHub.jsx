import { navigateGame } from './gameNavigation'
import LadderIcon from './Ladder-game/LadderIcon'
import worldCast from './Oligo-world/images/charactors1.png'
import './GameHub.css'

export default function GameHub() {
  return (
    <main className="game-hub-page">
      <div className="game-hub-shell">
        <header className="game-hub-header">
          <p>OLIGO-K PLAYGROUND</p>
          <h1>OLIGO GAME</h1>
          <span>잠깐의 쉼표, 새로운 지역 이야기</span>
        </header>

        <section className="game-hub-world" aria-labelledby="game-hub-world-title">
          <div className="game-hub-world-visual">
            <img src={worldCast} alt="한옥과 서울 야경 앞에 선 Oligo World의 세 탐험가" />
          </div>
          <div className="game-hub-world-copy">
            <span className="game-hub-world-tag">MAIN GAME · KOREA FANTASY</span>
            <h2 id="game-hub-world-title">OLIGO WORLD</h2>
            <p>한국의 어제, 오늘, 내일로.</p>
            <a href="/game/oligo-world" onClick={navigateGame}>Oligo World 시작하기</a>
            <small>새로운 세계를 준비하고 있습니다</small>
          </div>
        </section>

        <section className="game-hub-quick" aria-labelledby="game-hub-quick-title">
          <h2 id="game-hub-quick-title">QUICK GAME</h2>
          <div className="game-hub-quick-card">
            <LadderIcon className="game-hub-quick-icon" />
            <h3>오늘 뭐 먹지?</h3>
            <p>점심 메뉴부터 커피 당번까지, 가볍게 사다리타기</p>
            <a href="/game/ladder" onClick={navigateGame}>바로 하기</a>
          </div>
        </section>
      </div>
    </main>
  )
}
