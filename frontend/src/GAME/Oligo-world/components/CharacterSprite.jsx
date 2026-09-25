export default function CharacterSprite({ character, className = '' }) {
  return <img className={`oligo-world-character-sprite ${className}`}
    src={character.portrait} alt={`${character.name} 캐릭터`} />
}
