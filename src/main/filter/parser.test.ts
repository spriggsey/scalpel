import { describe, it, expect } from 'vitest'
import { parseFilterFile } from './parser'

describe('parseFilterFile', () => {
  it('parses Show and Hide blocks with correct count', () => {
    const content = `Show
    Rarity = Unique
    BaseType "Mirror of Kalandra"
    SetTextColor 175 96 37
    SetFontSize 45
    PlayAlertSound 6 300

Hide
    Class "Stackable Currency"
    SetBackgroundColor 0 0 0 200`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].visibility).toBe('Show')
    expect(result.blocks[1].visibility).toBe('Hide')
  })

  it('parses Minimal blocks', () => {
    const content = `Minimal
    Class "Currency"
    SetFontSize 18`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].visibility).toBe('Minimal')
  })

  it('parses conditions correctly', () => {
    const content = `Show
    Rarity = Unique
    BaseType "Mirror of Kalandra"
    Class "Currency"
    ItemLevel >= 75
    StackSize >= 10`

    const result = parseFilterFile('test.filter', content)
    const block = result.blocks[0]
    expect(block.conditions).toHaveLength(5)

    expect(block.conditions[0].type).toBe('Rarity')
    expect(block.conditions[0].values).toEqual(['Unique'])

    expect(block.conditions[1].type).toBe('BaseType')
    expect(block.conditions[1].values).toEqual(['Mirror of Kalandra'])

    expect(block.conditions[2].type).toBe('Class')
    expect(block.conditions[2].values).toEqual(['Currency'])

    expect(block.conditions[3].type).toBe('ItemLevel')
    expect(block.conditions[3].operator).toBe('>=')
    expect(block.conditions[3].values).toEqual(['75'])

    expect(block.conditions[4].type).toBe('StackSize')
    expect(block.conditions[4].operator).toBe('>=')
    expect(block.conditions[4].values).toEqual(['10'])
  })

  it('parses actions correctly', () => {
    const content = `Show
    BaseType "Chaos Orb"
    SetTextColor 175 96 37
    SetBackgroundColor 0 0 0 200
    SetBorderColor 255 0 0
    SetFontSize 45
    PlayAlertSound 6 300`

    const result = parseFilterFile('test.filter', content)
    const actions = result.blocks[0].actions
    expect(actions).toHaveLength(5)

    expect(actions[0].type).toBe('SetTextColor')
    expect(actions[0].values).toEqual(['175', '96', '37'])

    expect(actions[1].type).toBe('SetBackgroundColor')
    expect(actions[1].values).toEqual(['0', '0', '0', '200'])

    expect(actions[2].type).toBe('SetBorderColor')
    expect(actions[2].values).toEqual(['255', '0', '0'])

    expect(actions[3].type).toBe('SetFontSize')
    expect(actions[3].values).toEqual(['45'])

    expect(actions[4].type).toBe('PlayAlertSound')
    expect(actions[4].values).toEqual(['6', '300'])
  })

  it('handles comment-only lines (lines starting with #)', () => {
    const content = `# This is a comment
Show
    BaseType "Chaos Orb"

# Another comment
Hide
    Class "Gems"`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].leadingComment).toBe('# This is a comment')
    expect(result.blocks[1].leadingComment).toBe('# Another comment')
  })

  it('handles tier tags from inline comments', () => {
    const content = `Show # %D9 $type->currency $tier->t1
    BaseType "Mirror of Kalandra"`

    const result = parseFilterFile('test.filter', content)
    const block = result.blocks[0]
    expect(block.inlineComment).toBe('%D9 $type->currency $tier->t1')
    expect(block.tierTag).toEqual({ typePath: 'currency', tier: 't1', source: 'filterblade' })
  })

  it('handles poe1filter.com rule ids from inline comments', () => {
    const content = `#######################################################
### Generated with poe1filter.com
#######################################################

Show # Excellent Uniques (uniques-excellent)
    Rarity == Unique
    BaseType == "Vermillion Ring"

Show # Good Uniques (uniques-good)
    Rarity == Unique
    BaseType == "Diamond Ring"`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks[0].tierTag).toEqual({
      typePath: 'uniques',
      tier: 'excellent',
      source: 'poe1filter',
      label: 'Excellent Uniques',
      ruleId: 'uniques-excellent',
    })
    expect(result.blocks[1].tierTag).toMatchObject({
      typePath: 'uniques',
      tier: 'good',
    })
  })

  it('handles poe1filter.com unique tier board rows', () => {
    const content = `### Generated with poe1filter.com

Show # Excellent Uniques (uniques-excellent)
    Rarity == Unique
    BaseType == "Vermillion Ring"

Show # Class-specific Uniques (uniques-class-specific)
    Rarity == Unique
    BaseType == "Iron Ring"

Show # Potential Uniques (uniques-potential)
    Rarity == Unique
    BaseType == "Imperial Staff"

Show # Restricted Uniques (uniques-restricted)
    Rarity == Unique
    BaseType == "Lion Sword"

Show # Other Uniques (uniques-other)
    Rarity == Unique
    BaseType == "Gold Ring"

Show # Unknown Uniques (uniques-unknown)
    Rarity == Unique`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks.map((b) => b.tierTag?.typePath)).toEqual([
      'uniques',
      'uniques',
      'uniques',
      'uniques',
      'uniques',
      'uniques',
    ])
    expect(result.blocks.map((b) => b.tierTag?.tier)).toEqual([
      'excellent',
      'class-specific',
      'potential',
      'restricted',
      'other',
      'unknown',
    ])
  })

  it('skips duplicate poe1filter.com rule ids to avoid ambiguous tier edits', () => {
    const content = `### Generated with poe1filter.com

Show # Large Gold Stack (gold-leveling)
    BaseType == "Gold"

Hide # Small Gold Stack (gold-leveling)
    BaseType == "Gold"`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks[0].tierTag).toBeUndefined()
    expect(result.blocks[1].tierTag).toBeUndefined()
  })

  it('keeps poe1filter.com currency tier board rows despite duplicate rule ids', () => {
    const content = `### Generated with poe1filter.com

Show # S-Tier Currency (currency)
    Class == "Stackable Currency"
    BaseType == "Mirror of Kalandra"

Show # A-Tier Currency (currency)
    Class == "Stackable Currency"
    BaseType == "Fracturing Orb"

Show # S-Tier Divination Cards (currency)
    Class == "Divination Card"
    BaseType == "The Apothecary"`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks[0].tierTag).toMatchObject({
      typePath: 'currency',
      tier: 'S',
      source: 'poe1filter',
      label: 'S-Tier Currency',
      ruleId: 'currency',
    })
    expect(result.blocks[1].tierTag).toMatchObject({
      typePath: 'currency',
      tier: 'A',
    })
    expect(result.blocks[2].tierTag).toMatchObject({
      typePath: 'divination',
      tier: 'S',
    })
  })

  it('does not tag poe1filter.com stack-size currency override rows as tier move targets', () => {
    const content = `### Generated with poe1filter.com

Show # Large Stacks of A-Tier Currency (currency-large-stacks)
    Class == "Stackable Currency"
    BaseType == "Fracturing Orb"
    StackSize >= 10

Show # A-Tier Currency (currency)
    Class == "Stackable Currency"
    BaseType == "Fracturing Orb"`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks[0].tierTag).toBeUndefined()
    expect(result.blocks[1].tierTag).toMatchObject({
      typePath: 'currency',
      tier: 'A',
    })
  })

  it('drops poe1filter.com empty currency tier stubs from tier move targets', () => {
    const content = `### Generated with poe1filter.com

Show # D-Tier Currency (currency)
    Class == "Stackable Currency"

Show # D-Tier Currency (currency)
    Class == "Stackable Currency"
    BaseType == "Chaos Orb"`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks[0].tierTag).toBeUndefined()
    expect(result.blocks[1].tierTag).toMatchObject({
      typePath: 'currency',
      tier: 'D',
    })
  })

  it('does not tag poe1filter.com map threshold and special-case rows as tier move targets', () => {
    const content = `### Generated with poe1filter.com

Show # Maps (maps-dynamic)
    Class == "Maps"
    MapTier >= 11

Show # Nightmare 8-Mod (maps-tier-17-corrupted)
    Class == "Maps"
    MapTier == 17

Show # T16 Memory-Influenced Normal (maps-tier-16-memory-strands)
    Class == "Maps"
    MapTier == 16

Show # Low-Tier Blighted (maps-low-tier-blighted)
    Class == "Maps"
    MapTier >= 1`

    const result = parseFilterFile('test.filter', content)

    expect(result.blocks.map((b) => b.tierTag)).toEqual([undefined, undefined, undefined, undefined])
  })

  it('can force poe1filter.com parsing without a generator header', () => {
    const content = `Show # My Excellent Item Level Amulets (jewellery-my-excellent-ilevel/jewellery/2)
    Class == "Amulets"`

    const result = parseFilterFile('test.filter', content, 'poe1filter')

    expect(result.blocks[0].tierTag).toMatchObject({
      typePath: 'jewellery/2',
      tier: 'my-excellent-ilevel',
      source: 'poe1filter',
    })
  })

  it('handles quoted and unquoted values', () => {
    const content = `Show
    BaseType "Chaos Orb" "Exalted Orb"
    Rarity Unique`

    const result = parseFilterFile('test.filter', content)
    const block = result.blocks[0]

    expect(block.conditions[0].type).toBe('BaseType')
    expect(block.conditions[0].values).toEqual(['Chaos Orb', 'Exalted Orb'])

    expect(block.conditions[1].type).toBe('Rarity')
    expect(block.conditions[1].values).toEqual(['Unique'])
  })

  it('handles comparison operators (>=, <=, >, <, =, ==)', () => {
    const content = `Show
    ItemLevel >= 80
    Quality <= 10
    StackSize > 5
    GemLevel < 20
    Rarity = Rare
    BaseType == "Sapphire Ring"`

    const result = parseFilterFile('test.filter', content)
    const conds = result.blocks[0].conditions

    expect(conds[0].operator).toBe('>=')
    expect(conds[0].explicitOperator).toBe(true)

    expect(conds[1].operator).toBe('<=')
    expect(conds[2].operator).toBe('>')
    expect(conds[3].operator).toBe('<')
    expect(conds[4].operator).toBe('=')

    expect(conds[5].operator).toBe('==')
    expect(conds[5].values).toEqual(['Sapphire Ring'])
  })

  it('preserves block ordering', () => {
    const content = `Show
    Rarity Unique

Hide
    Rarity Rare

Show
    Rarity Magic`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks).toHaveLength(3)
    expect(result.blocks[0].visibility).toBe('Show')
    expect(result.blocks[0].conditions[0].values).toEqual(['Unique'])
    expect(result.blocks[1].visibility).toBe('Hide')
    expect(result.blocks[1].conditions[0].values).toEqual(['Rare'])
    expect(result.blocks[2].visibility).toBe('Show')
    expect(result.blocks[2].conditions[0].values).toEqual(['Magic'])
  })

  it('returns rawLines and path', () => {
    const content = `Show\n    Rarity Unique`
    const result = parseFilterFile('my.filter', content)
    expect(result.path).toBe('my.filter')
    expect(result.rawLines).toEqual(['Show', '    Rarity Unique'])
  })

  it('handles Continue keyword', () => {
    const content = `Show
    Rarity Unique
    Continue`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks[0].continue).toBe(true)
  })

  it('handles DropLevel condition', () => {
    const content = `Show
    DropLevel >= 60`

    const result = parseFilterFile('test.filter', content)
    expect(result.blocks[0].conditions[0].type).toBe('DropLevel')
    expect(result.blocks[0].conditions[0].operator).toBe('>=')
    expect(result.blocks[0].conditions[0].values).toEqual(['60'])
  })
})
