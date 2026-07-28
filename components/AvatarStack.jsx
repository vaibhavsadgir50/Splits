import Avatar, { AVATAR_SIZES } from './Avatar'

export default function AvatarStack({ names = [], size = 'sm', max = 4 }) {
  const shown = names.slice(0, max)
  const overflow = names.length - shown.length

  return (
    <span className="inline-flex items-center">
      {shown.map((name, i) => (
        <span key={name} className={i > 0 ? '-ml-3' : ''} style={{ zIndex: shown.length - i }}>
          <Avatar name={name} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`-ml-3 inline-flex items-center justify-center rounded-full ring-2 ring-white bg-on-surface text-white font-mono font-bold flex-shrink-0 ${AVATAR_SIZES[size]}`}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
