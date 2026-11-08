import { RunStorage } from '../../lib/types/persistence/storage.js'
const storage = await RunStorage.acquire(process.argv[2])
process.send({ ready: true })
process.on('message', () => { storage.dispose(); process.disconnect() })
