import { describe, expect, it } from 'vitest'
import * as myVersions from './myVersions.ts'
import {
  addVersion,
  commitVersion,
  hydrateVersions,
  removeVersion,
  updateVersion,
  versionsFor,
  type MyVersion,
} from './myVersions.ts'

/**
 * Her versions are the only content in this app that cannot be regenerated from
 * the repo, so this suite is less about shape than about loss. Every test here
 * is a way she could lose writing she cannot get back.
 */

const WHEN = new Date('2026-08-04T14:00:00.000Z')
const LATER = new Date('2026-08-05T09:00:00.000Z')

function draft(patch: Partial<myVersions.MyVersionDraft> = {}): myVersions.MyVersionDraft {
  return { title: 'My cornbread', body: 'Applesauce where the oil went.', subjectId: 'cornbread', ...patch }
}

describe('hydrateVersions', () => {
  it('returns an empty list for anything unusable', () => {
    expect(hydrateVersions(null)).toEqual([])
    expect(hydrateVersions('nope')).toEqual([])
    expect(hydrateVersions({})).toEqual([])
  })

  it('reads both the wrapped and the bare array shapes', () => {
    const row = { id: 'a', title: 'Mine', body: '', subjectId: null, savedAt: '', updatedAt: '' }
    expect(hydrateVersions({ schemaVersion: 1, items: [row] })).toHaveLength(1)
    expect(hydrateVersions([row])).toHaveLength(1)
  })

  it('costs one row rather than the list when a row is corrupt', () => {
    const versions = hydrateVersions([
      { id: 'a', title: 'Kept', body: 'one', subjectId: null, savedAt: '', updatedAt: '' },
      { id: 'b' },
      'garbage',
      { title: 'no id' },
      { id: 'c', title: 'Also kept', body: 'two', subjectId: null, savedAt: '', updatedAt: '' },
    ])
    expect(versions.map((version) => version.title)).toEqual(['Kept', 'Also kept'])
  })

  it('keeps a version whose body is empty, because a title alone is valid', () => {
    const versions = hydrateVersions([{ id: 'a', title: 'Worth remembering' }])
    expect(versions).toHaveLength(1)
    expect(versions.at(0)?.body).toBe('')
  })

  it('keeps a version whose subject is no longer in the file', () => {
    /*
     * The whole point of storing subjectId as a key rather than a snapshot. If
     * an entry is removed from substitutions.json, her writing about it survives
     * with no guidance block rather than disappearing with the entry.
     */
    const versions = hydrateVersions([
      { id: 'a', title: 'My fried apples', body: 'No butter needed.', subjectId: 'removed-entry' },
    ])
    expect(versions).toHaveLength(1)
    expect(versions.at(0)?.subjectId).toBe('removed-entry')
    expect(versions.at(0)?.body).toBe('No butter needed.')
  })

  it('collapses duplicate ids, keeping the first', () => {
    const versions = hydrateVersions([
      { id: 'a', title: 'First' },
      { id: 'a', title: 'Second' },
    ])
    expect(versions).toHaveLength(1)
    expect(versions.at(0)?.title).toBe('First')
  })
})

describe('addVersion', () => {
  it('puts the newest first and stamps both timestamps', () => {
    const one = addVersion([], draft({ title: 'First' }), WHEN)
    const two = addVersion(one, draft({ title: 'Second' }), LATER)
    expect(two.map((version) => version.title)).toEqual(['Second', 'First'])
    expect(two.at(0)?.savedAt).toBe(LATER.toISOString())
    expect(two.at(0)?.updatedAt).toBe(LATER.toISOString())
  })

  it('trims the title but leaves the body exactly as she wrote it', () => {
    const body = '  two spaces in front, and a trailing newline\n'
    const versions = addVersion([], draft({ title: '  My cornbread  ', body }), WHEN)
    expect(versions.at(0)?.title).toBe('My cornbread')
    expect(versions.at(0)?.body).toBe(body)
  })
})

describe('commitVersion', () => {
  it('ADDS on a repeated title rather than overwriting', () => {
    /*
     * The guard on the decision documented above commitVersion in myVersions.ts.
     * savedRestaurants.commitSaved deliberately does the opposite. If someone
     * ever "fixes" this into an upsert to match, this test is what stops it.
     */
    const first = commitVersion([], draft({ title: 'My cornbread', body: 'winter attempt' }), WHEN)
    const both = commitVersion(first, draft({ title: 'My cornbread', body: 'spring attempt' }), LATER)

    expect(both).toHaveLength(2)
    expect(both.map((version) => version.body)).toEqual(['spring attempt', 'winter attempt'])
  })

  it('gives the second one its own id', () => {
    const first = commitVersion([], draft(), WHEN)
    const both = commitVersion(first, draft(), LATER)
    expect(both.at(0)?.id).not.toBe(both.at(1)?.id)
  })
})

describe('updateVersion', () => {
  it('edits in place and moves only updatedAt', () => {
    const versions = addVersion([], draft(), WHEN)
    const id = versions.at(0)?.id ?? ''
    const edited = updateVersion(versions, id, draft({ body: 'better now' }), LATER)

    expect(edited.at(0)?.body).toBe('better now')
    expect(edited.at(0)?.savedAt).toBe(WHEN.toISOString())
    expect(edited.at(0)?.updatedAt).toBe(LATER.toISOString())
  })

  it('is a no-op on an unknown id', () => {
    const versions = addVersion([], draft(), WHEN)
    expect(updateVersion(versions, 'not-an-id', draft({ body: 'x' }), LATER)).toEqual(versions)
  })
})

describe('removeVersion', () => {
  it('removes exactly one row and leaves the rest alone', () => {
    const versions = addVersion(addVersion([], draft({ title: 'A' }), WHEN), draft({ title: 'B' }), LATER)
    const id = versions.at(0)?.id ?? ''
    const after = removeVersion(versions, id)

    expect(after).toHaveLength(1)
    expect(after.at(0)?.title).toBe('A')
  })

  it('is a no-op on an unknown id, and removes nothing else', () => {
    const versions = addVersion([], draft(), WHEN)
    expect(removeVersion(versions, 'not-an-id')).toEqual(versions)
    expect(removeVersion(versions, '')).toEqual(versions)
  })

  it('is the only removal path the module exposes', () => {
    /*
     * A bulk clear is the single easiest way for her to lose all of this at
     * once, so the module is not allowed to grow one. If a reset feature is ever
     * built it has to reach for removeVersion per row, or give myVersions its
     * own separate confirmation. See the warning on storage.clearAll.
     */
    const removers = Object.keys(myVersions).filter((name) => /clear|remove|delete|wipe|reset/i.test(name))
    expect(removers).toEqual(['removeVersion'])
  })
})

describe('versionsFor', () => {
  it('picks out the ones she wrote about one entry', () => {
    const versions: MyVersion[] = [
      { id: 'a', title: 'A', body: '', subjectId: 'cornbread', savedAt: '', updatedAt: '' },
      { id: 'b', title: 'B', body: '', subjectId: 'soup-beans', savedAt: '', updatedAt: '' },
      { id: 'c', title: 'C', body: '', subjectId: null, savedAt: '', updatedAt: '' },
    ]
    expect(versionsFor(versions, 'cornbread').map((version) => version.id)).toEqual(['a'])
  })

  it('never matches a freehand version, which belongs to no entry', () => {
    const versions: MyVersion[] = [
      { id: 'c', title: 'C', body: '', subjectId: null, savedAt: '', updatedAt: '' },
    ]
    expect(versionsFor(versions, 'cornbread')).toEqual([])
  })
})
