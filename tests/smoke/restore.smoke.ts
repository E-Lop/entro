/** Il ripristino dei dati noti, come comando: `npm run smoke:restore` (#187). */
import { it } from 'vitest'
import { signIn } from './env'
import { restore } from './restore'

it('ripristino dei dati noti', async () => {
  const a = await signIn('A')
  const b = await signIn('B')
  await restore(a, b)
})
