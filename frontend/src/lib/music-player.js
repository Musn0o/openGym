import { Capacitor, registerPlugin } from '@capacitor/core'
import { getMusic } from './music-store.js'

const Music = registerPlugin('MusicPlayer')
const isNative = () => Capacitor.isNativePlatform()

export async function pickMusicTracks() {
  if (!isNative()) return []
  const res = await Music.pick()
  return Array.isArray(res?.tracks) ? res.tracks : []
}

export async function scanDeviceMusic() {
  if (!isNative()) return []
  try {
    const res = await Music.scan()
    return Array.isArray(res?.tracks) ? res.tracks : []
  } catch { return [] }
}

export async function removeMusicFile(src) {
  if (!isNative() || !src) return
  try { await Music.remove({ src }) } catch {}
}

export async function playMusicPlaylist(playlistId, index = 0) {
  if (!isNative()) return
  const m = getMusic()
  const p = m.playlists.find(x => x.id === playlistId)
  if (!p || p.tracks.length === 0) return
  const tracks = p.tracks.map(t => ({ name: t.name, ...(t.src ? { src: t.src } : {}), ...(t.uri ? { uri: t.uri } : {}) }))
  await Music.play({ tracks, index: Math.max(0, Math.min(index, tracks.length - 1)), title: p.name })
}

export async function pauseMusic() { if (isNative()) try { await Music.pause() } catch {} }
export async function resumeMusic() { if (isNative()) try { await Music.resume() } catch {} }
export async function stopMusic() { if (isNative()) try { await Music.stop() } catch {} }
export async function nextMusic() { if (isNative()) try { await Music.next() } catch {} }
export async function prevMusic() { if (isNative()) try { await Music.prev() } catch {} }
export async function musicState() {
  if (!isNative()) return { playing: false, index: 0, title: '', playlist: '' }
  try { return await Music.state() } catch { return { playing: false, index: 0, title: '', playlist: '' } }
}

export async function musicPermission() {
  if (!isNative()) return 'granted'
  try { return (await Music.permission?.())?.state || 'unknown' } catch { return 'unknown' }
}
