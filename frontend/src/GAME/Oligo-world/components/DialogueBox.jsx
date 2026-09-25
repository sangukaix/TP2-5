import CharacterSprite from './CharacterSprite'

export default function DialogueBox({ character, text, onContinue }) {
  return (
    <section className="oligo-world-dialogue" aria-label="튜토리얼 대화">
      <CharacterSprite character={character} className="oligo-world-dialogue-portrait" />
      <div className="oligo-world-dialogue-copy">
        <strong>{character.name}</strong>
        <p>{text}</p>
      </div>
      <button type="button" onClick={onContinue}>계속 ↵</button>
    </section>
  )
}
