// NTRP (National Tennis Rating Program) level descriptions
// Designed to be approachable for people unfamiliar with the rating system

export interface NtrpLevel {
  rating: number
  label: string
  shortDescription: string
  details: string[]
}

export const ntrpLevels: NtrpLevel[] = [
  {
    rating: 1.5,
    label: 'New Player',
    shortDescription: "You're just starting out and learning the basics.",
    details: [
      'Learning how to grip the racket and swing',
      'Working on making contact with the ball',
      'Just getting comfortable on the court',
    ],
  },
  {
    rating: 2.0,
    label: 'Beginner',
    shortDescription: 'You can hit the ball back and forth but rallies are short.',
    details: [
      'Can sustain a short rally with someone at a similar level',
      'Forehand is more consistent than backhand',
      'Starting to learn where to stand on the court',
    ],
  },
  {
    rating: 2.5,
    label: 'Advanced Beginner',
    shortDescription: 'You can rally and are starting to play actual points.',
    details: [
      'Can rally consistently on forehand side',
      'Serve often goes in, but double faults happen',
      'Starting to approach the net sometimes',
      'Learning to keep score and play matches',
    ],
  },
  {
    rating: 3.0,
    label: 'Intermediate',
    shortDescription: "You're consistent and can play a real match.",
    details: [
      'Fairly consistent strokes on both forehand and backhand',
      'Can serve with some control and rarely double faults',
      'Can play at the net a little',
      'Starting to use spin and placement intentionally',
    ],
  },
  {
    rating: 3.5,
    label: 'Strong Intermediate',
    shortDescription: 'You have solid strokes and can compete in local leagues.',
    details: [
      'Good stroke mechanics with decent power and consistency',
      'Can place serves and hit with spin',
      'Comfortable at the net on volleys',
      'Developing game strategy (where to hit, when to approach)',
      'This is the most common level for regular recreational players',
    ],
  },
  {
    rating: 4.0,
    label: 'Advanced Intermediate',
    shortDescription: "You're a strong club player with reliable all-around game.",
    details: [
      'Consistent, powerful strokes with good control',
      'Strong serve that can be an offensive weapon',
      'Good net play and can execute approach shots',
      'Can adjust game plan based on opponent',
      'Plays competitively in local tournaments or leagues',
    ],
  },
  {
    rating: 4.5,
    label: 'Advanced',
    shortDescription: 'You have a weapon (big serve, forehand, etc.) and strong tactics.',
    details: [
      'Has developed a dominant shot or pattern',
      'Can vary spin, pace, and placement at will',
      'Rarely makes unforced errors on moderate pace balls',
      'Strong competitive experience',
    ],
  },
  {
    rating: 5.0,
    label: 'Tournament Player',
    shortDescription: 'You compete regularly in tournaments with strong results.',
    details: [
      'All strokes are weapons — can hit winners from anywhere',
      'Excellent tactical awareness and shot selection',
      'Competes in high-level local/regional tournaments',
      'May have played college tennis or equivalent',
    ],
  },
]

export function getNtrpLabel(rating: number): string {
  const level = ntrpLevels.find((l) => l.rating === rating)
  return level ? `${level.rating} — ${level.label}` : `${rating}`
}
