/**
 * ID d'application Discord pour la Rich Presence via le client de bureau (IPC local).
 * Laissez vide pour désactiver la Rich Presence sans config utilisateur.
 * Créez une app sur https://discord.com/developers et collez l'ID ici pour l'activer par défaut.
 */
export const PC_CONSOLE_OS_DISCORD_APP_ID = ''

export function getEffectiveDiscordAppId(userAppId?: string): string {
  return userAppId?.trim() || PC_CONSOLE_OS_DISCORD_APP_ID
}
