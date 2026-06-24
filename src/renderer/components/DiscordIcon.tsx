import discordIcon from '../assets/discord-icon.png'

export function DiscordIcon({
  size = 20,
  className = ''
}: {
  size?: number
  className?: string
}): JSX.Element {
  return (
    <img
      src={discordIcon}
      alt=""
      width={size}
      height={size}
      className={`object-contain flex-shrink-0 ${className}`}
      draggable={false}
    />
  )
}
