import { describe, it, expect } from 'vitest'
import { musicOf, createPlaylist, addTracks, playlistTracks, renameTrack, setPlaybackIndex, setPlaylistSort, setActivePlaylist } from './music.js'

const base = () => ({ playlists: [], last: null, active: null, progress: {}, sorts: {} })
const track = (id, name, dur, at) => ({ id, name, src: id + '.mp3', dur, at })

describe('local music playlists', () => {
  it('keeps multiple playlists and imported tracks', () => {
    let m = base()
    m = createPlaylist(m, 'Push')
    m = createPlaylist(m, 'Pull')
    m = addTracks(m, m.playlists[0].id, [track('a', 'A', 100, 1), track('b', 'B', 200, 2)])
    expect(m.playlists.map(p => p.name)).toEqual(['Push', 'Pull'])
    expect(m.playlists[0].tracks.map(t => t.name)).toEqual(['A', 'B'])
  })

  it('sorts tracks for playback', () => {
    let m = base()
    m = createPlaylist(m, 'P')
    const id = m.playlists[0].id
    m = addTracks(m, id, [track('a', 'Zeta', 300, 1), track('b', 'Alpha', 100, 2)])
    expect(playlistTracks(m, id).map(t => t.name)).toEqual(['Zeta', 'Alpha'])
    m = setPlaylistSort(m, id, 'name')
    expect(playlistTracks(m, id).map(t => t.name)).toEqual(['Alpha', 'Zeta'])
    m = setPlaylistSort(m, id, 'duration')
    expect(playlistTracks(m, id).map(t => t.name)).toEqual(['Alpha', 'Zeta'])
  })

  it('renames tracks and remembers playback position and active playlist', () => {
    let m = base()
    m = createPlaylist(m, 'P')
    const id = m.playlists[0].id
    m = addTracks(m, id, [track('a', 'A', 100, 1)])
    m = renameTrack(m, id, 'a', 'Warm up')
    m = setPlaybackIndex(setActivePlaylist(m, id), id, 4)
    expect(musicOf(m).playlists[0].tracks[0].name).toBe('Warm up')
    expect(musicOf(m).progress[id]).toBe(4)
    expect(musicOf(m).active).toBe(id)
  })
})
