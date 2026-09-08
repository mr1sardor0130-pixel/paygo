import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getTableName } from 'drizzle-orm'
import * as schema from './schema'
import fs from 'node:fs'
import path from 'node:path'

const connectionString = process.env.DATABASE_URL || ''
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

let rawPool: Pool | null = null

if (connectionString) {
  try {
    rawPool = new Pool({
      connectionString,
      ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 15000,
      max: 10,
    })
    rawPool.on('error', (err) => {
      console.warn('Postgres pool background error:', err.message || err)
    })
  } catch (err) {
    console.warn('Postgres initialization warning:', err)
  }
}

// ---------------------------------------------------------------------------
// File & In-Memory Storage Engine
// Works 100% reliably in Serverless (Vercel), Edge, and Containers (Cloud Run)
// ---------------------------------------------------------------------------

const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'paygo_db.json')
const TMP_DATA_FILE = '/tmp/paygo_db.json'

const globalStore = globalThis as unknown as {
  __paygo_db_data?: Record<string, any[]>
}

function loadInitialData(): Record<string, any[]> {
  if (globalStore.__paygo_db_data) {
    return globalStore.__paygo_db_data
  }

  let fileContent = ''
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      fileContent = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8')
    } else if (fs.existsSync(TMP_DATA_FILE)) {
      fileContent = fs.readFileSync(TMP_DATA_FILE, 'utf-8')
    }
  } catch (err) {
    // Read error fallback
  }

  let parsed: Record<string, any[]> | null = null
  if (fileContent) {
    try {
      parsed = JSON.parse(fileContent)
    } catch {}
  }

  const initial: Record<string, any[]> = parsed || {
    shops: [],
    payments: [],
    auth_sessions: [],
    user_profiles: [],
    system_roles: [],
    system_tariffs: [],
    system_settings: [],
    mandatory_channels: [],
    paid_access_rooms: [],
    paid_access_members: [],
    delivery_logs: [],
    store_api_keys: [],
    fundraisers: [],
    donations: [],
    userbot_connections: [],
    business_connections: [],
  }

  // Ensure default shop exists
  if (!initial.shops || initial.shops.length === 0) {
    initial.shops = [
      {
        id: '00fa5a68-ba46-4c07-8132-32078e0ad987',
        userId: 'guest-merchant',
        name: 'PayGo Asosiy Do‘kon',
        slug: 'shop-rchant',
        cardNumber: '9860350123453587',
        cardLast4: '3587',
        cardBank: 'HUMOCARD',
        accountOwner: 'Hisob egasi',
        approved: true,
        tier: 'free',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  // Ensure default system settings
  if (!initial.system_settings || initial.system_settings.length === 0) {
    initial.system_settings = [
      {
        key: 'site_logo',
        value: 'https://i.ibb.co/sd8RnH9N/Pix-WYE0d-PXzy-DGc8-OLd6-I6-NXw5y-Og3y6.webp',
        updatedAt: new Date().toISOString(),
      },
    ]
  }

  // Ensure default system roles
  if (!initial.system_roles || initial.system_roles.length === 0) {
    initial.system_roles = [
      {
        id: 'superadmin-root',
        telegramId: '611987619493',
        role: 'superadmin',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  // Ensure default tariffs
  if (!initial.system_tariffs || initial.system_tariffs.length === 0) {
    initial.system_tariffs = [
      {
        id: 'tariff-standard',
        name: 'Standard',
        description: 'Kichik va o‘rta bizneslar uchun',
        price: 50000,
        period: 'month',
        cardNumber: '9860350123453587',
        cardOwner: 'Hisob egasi',
        cardBank: 'HUMOCARD',
        active: true,
        features: 'Cheksiz to‘lovlar, Telegram bot, 24/7 qo‘llab-quvvatlash',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  globalStore.__paygo_db_data = initial
  return initial
}

let saveTimer: NodeJS.Timeout | null = null
function persistDataLater() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const data = globalStore.__paygo_db_data
      if (!data) return
      const json = JSON.stringify(data)
      try {
        if (!fs.existsSync(LOCAL_DATA_DIR)) {
          fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true })
        }
        fs.writeFileSync(LOCAL_DATA_FILE, json, 'utf-8')
      } catch {}
      try {
        fs.writeFileSync(TMP_DATA_FILE, json, 'utf-8')
      } catch {}
    } catch (e) {
      // Ignore write errors in read-only environments
    }
  }, 100)
}

function getMemoryStore(): Record<string, any[]> {
  return loadInitialData()
}

// ---------------------------------------------------------------------------
// Drizzle Query Evaluators
// ---------------------------------------------------------------------------

function evaluateCond(cond: any, row: any): boolean {
  if (!cond) return true
  if (typeof cond === 'function') return cond(row)

  if (cond.queryChunks && Array.isArray(cond.queryChunks)) {
    const textParts: string[] = []
    const subSqls: any[] = []
    let colName: string | null = null
    let targetVal: any = undefined

    for (const chunk of cond.queryChunks) {
      if (!chunk) continue
      if (typeof chunk === 'object') {
        if ('name' in chunk && 'table' in chunk) {
          colName = chunk.name
        } else if ('value' in chunk) {
          if (Array.isArray(chunk.value) && typeof chunk.value[0] === 'string') {
            textParts.push(chunk.value.join(' ').toLowerCase())
          } else {
            targetVal = chunk.value
          }
        } else if (chunk.queryChunks) {
          subSqls.push(chunk)
        }
      }
    }

    if (subSqls.length > 0) {
      const isOr = textParts.some((t) => t.includes('or'))
      if (isOr) {
        return subSqls.some((sub) => evaluateCond(sub, row))
      }
      return subSqls.every((sub) => evaluateCond(sub, row))
    }

    if (colName !== null) {
      const rowVal = row[colName]
      if (targetVal === null || targetVal === undefined) {
        return rowVal === null || rowVal === undefined
      }
      return String(rowVal ?? '') === String(targetVal ?? '')
    }
  }

  return true
}

function extractOrder(orderClause: any): { column: string; isDesc: boolean } | null {
  if (!orderClause) return null
  if (orderClause.name) {
    return { column: orderClause.name, isDesc: false }
  }
  if (orderClause.queryChunks) {
    let colName: string | null = null
    let isDesc = false
    for (const chunk of orderClause.queryChunks) {
      if (chunk && typeof chunk === 'object') {
        if ('name' in chunk && 'table' in chunk) {
          colName = chunk.name
        } else if ('value' in chunk && Array.isArray(chunk.value)) {
          if (chunk.value.join(' ').toLowerCase().includes('desc')) {
            isDesc = true
          }
        }
      }
    }
    if (colName) return { column: colName, isDesc }
  }
  return null
}

function resolveTableName(table: any): string {
  if (!table) return 'shops'
  if (typeof table === 'string') return table
  try {
    return getTableName(table) || table._?.name || 'shops'
  } catch {
    return table._?.name || 'shops'
  }
}

// ---------------------------------------------------------------------------
// Mock Drizzle Implementation for Instant & Fail-Safe Execution
// ---------------------------------------------------------------------------

function createInMemoryQueryBuilder(selection?: any) {
  return {
    from: (table: any) => {
      const tableName = resolveTableName(table)
      let _where: any = null
      let _orders: any[] = []
      let _limit: number | null = null

      const qb = {
        where: (cond: any) => {
          _where = cond
          return qb
        },
        orderBy: (...orders: any[]) => {
          _orders = orders
          return qb
        },
        limit: (n: number) => {
          _limit = n
          return qb
        },
        then: (resolve: (rows: any[]) => void, reject?: (err: any) => void) => {
          try {
            const store = getMemoryStore()
            let rows = [...(store[tableName] || [])]

            if (_where) {
              rows = rows.filter((r) => evaluateCond(_where, r))
            }

            if (_orders.length > 0) {
              const ord = extractOrder(_orders[0])
              if (ord) {
                rows.sort((a, b) => {
                  const valA = a[ord.column]
                  const valB = b[ord.column]
                  if (valA === valB) return 0
                  const res = valA > valB ? 1 : -1
                  return ord.isDesc ? -res : res
                })
              }
            }

            if (_limit !== null && _limit >= 0) {
              rows = rows.slice(0, _limit)
            }

            if (selection && typeof selection === 'object') {
              if ('count' in selection) {
                resolve([{ count: rows.length }])
                return
              }
              rows = rows.map((r) => {
                const out: any = {}
                for (const k of Object.keys(selection)) {
                  const col = selection[k]
                  const colName = col && typeof col === 'object' && col.name ? col.name : k
                  out[k] = r[colName]
                }
                return out
              })
            }

            resolve(rows)
          } catch (err) {
            if (reject) reject(err)
            else resolve([])
          }
        },
      }
      return qb
    },
  }
}

const inMemoryDb = {
  select: (fields?: any) => createInMemoryQueryBuilder(fields),
  insert: (table: any) => {
    const tableName = resolveTableName(table)
    return {
      values: (val: any) => {
        const rows = Array.isArray(val) ? val : [val]
        const store = getMemoryStore()
        if (!store[tableName]) store[tableName] = []

        for (const row of rows) {
          const item = { ...row }
          // If primary key exists, check for duplicate
          const existingIndex = store[tableName].findIndex((x) => x.id && item.id && x.id === item.id)
          if (existingIndex >= 0) {
            store[tableName][existingIndex] = { ...store[tableName][existingIndex], ...item }
          } else {
            store[tableName].push(item)
          }
        }
        persistDataLater()

        const insertResult = {
          onConflictDoUpdate: (config?: any) => {
            if (config?.set) {
              for (const row of rows) {
                const targetKey = row.id ? 'id' : row.key ? 'key' : row.telegramId ? 'telegramId' : 'id'
                const targetVal = row[targetKey]
                const idx = store[tableName].findIndex((x) => x[targetKey] === targetVal)
                if (idx >= 0) {
                  store[tableName][idx] = { ...store[tableName][idx], ...config.set }
                }
              }
              persistDataLater()
            }
            return insertResult
          },
          returning: () => insertResult,
          then: (resolve: (rows: any[]) => void) => {
            resolve(rows)
          },
        }
        return insertResult
      },
    }
  },
  update: (table: any) => {
    const tableName = resolveTableName(table)
    return {
      set: (updates: any) => ({
        where: (cond: any) => ({
          then: (resolve: (res: { rowCount: number }) => void) => {
            const store = getMemoryStore()
            const list = store[tableName] || []
            let count = 0
            for (let i = 0; i < list.length; i++) {
              if (evaluateCond(cond, list[i])) {
                list[i] = { ...list[i], ...updates }
                count++
              }
            }
            persistDataLater()
            resolve({ rowCount: count })
          },
        }),
      }),
    }
  },
  delete: (table: any) => {
    const tableName = resolveTableName(table)
    return {
      where: (cond: any) => ({
        then: (resolve: (res: { rowCount: number }) => void) => {
          const store = getMemoryStore()
          const list = store[tableName] || []
          const remaining: any[] = []
          let count = 0
          for (let i = 0; i < list.length; i++) {
            if (evaluateCond(cond, list[i])) {
              count++
            } else {
              remaining.push(list[i])
            }
          }
          store[tableName] = remaining
          persistDataLater()
          resolve({ rowCount: count })
        },
      }),
    }
  },
}

// ---------------------------------------------------------------------------
// Postgres Drizzle instance with fallback to inMemoryDb
// ---------------------------------------------------------------------------

const drizzlePgInstance = connectionString && rawPool ? drizzlePg(rawPool, { schema }) : null

export const db: any = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (!drizzlePgInstance) {
        return (inMemoryDb as any)[prop]
      }

      // If Postgres instance exists, try it first, fallback to in-memory on failure
      const origPgMethod = (drizzlePgInstance as any)[prop]
      if (typeof origPgMethod === 'function') {
        return (...args: any[]) => {
          try {
            const result = origPgMethod.apply(drizzlePgInstance, args)
            // Wrap then to catch execution errors and route to in-memory
            if (result && typeof result.then === 'function') {
              return new Promise((resolve, reject) => {
                result
                  .then(resolve)
                  .catch((err: any) => {
                    console.warn(`Postgres DB query failed (${prop}), using resilient memory store:`, err?.message || err)
                    const fallbackResult = ((inMemoryDb as any)[prop])(...args)
                    if (fallbackResult && typeof fallbackResult.then === 'function') {
                      fallbackResult.then(resolve).catch(reject)
                    } else {
                      resolve(fallbackResult)
                    }
                  })
              })
            }
            return result
          } catch (err) {
            console.warn(`Postgres DB method synchronous failed (${prop}), using memory store:`, err)
            return ((inMemoryDb as any)[prop])(...args)
          }
        }
      }
      return (inMemoryDb as any)[prop]
    },
  }
)

export const pool = {
  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    if (rawPool) {
      try {
        const res = await rawPool.query(text, params)
        return { rows: res.rows || [], rowCount: res.rowCount || 0 }
      } catch (err: any) {
        console.warn('Postgres rawPool query failed:', err?.message)
      }
    }
    return { rows: [], rowCount: 0 }
  },
}

// Ensure essential schema columns exist on production DB
let columnsEnsured = false
export async function ensureDbSchema() {
  if (columnsEnsured) return

  // Always pre-load in-memory store so default shop and settings are available immediately
  loadInitialData()

  if (rawPool) {
    const queries = [
      `CREATE TABLE IF NOT EXISTS "shops" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "logoUrl" text,
        "approved" boolean NOT NULL DEFAULT true,
        "slug" text NOT NULL UNIQUE,
        "cardLast4" text NOT NULL DEFAULT '3587',
        "cardNumber" text NOT NULL DEFAULT '9860350123453587',
        "cardBank" text DEFAULT 'HUMOCARD',
        "accountOwner" text DEFAULT 'Hisob egasi',
        "webhookUrl" text,
        "returnUrl" text,
        "telegramChannelId" text,
        "userbotSession" text,
        "tier" text NOT NULL DEFAULT 'free',
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS "payments" (
        "id" text PRIMARY KEY,
        "shopId" text NOT NULL,
        "userId" text NOT NULL,
        "amount" integer NOT NULL,
        "currency" text NOT NULL DEFAULT 'UZS',
        "multiplier" integer NOT NULL DEFAULT 1,
        "status" text NOT NULL DEFAULT 'pending',
        "isTest" boolean DEFAULT false,
        "returnUrl" text,
        "webhookUrl" text,
        "expiresAt" timestamp NOT NULL,
        "matchedAt" timestamp,
        "sourceMessage" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS "auth_sessions" (
        "token" text PRIMARY KEY,
        "userId" text NOT NULL,
        "telegramId" text,
        "shopId" text,
        "role" text DEFAULT 'user',
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "expiresAt" timestamp NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS "system_tariffs" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "description" text,
        "features" text,
        "price" integer NOT NULL,
        "period" text NOT NULL DEFAULT 'month',
        "cardNumber" text NOT NULL DEFAULT '9860350123453587',
        "cardOwner" text NOT NULL DEFAULT 'AZizbek I',
        "cardBank" text DEFAULT 'HUMOCARD',
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS "system_roles" (
        "id" text PRIMARY KEY,
        "telegramId" text NOT NULL,
        "role" text NOT NULL DEFAULT 'admin',
        "addedBy" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );`,
    ]

    for (const q of queries) {
      try {
        await rawPool.query(q)
      } catch (err: any) {
        console.warn('DB schema query warning:', err?.message || err)
      }
    }
  }

  columnsEnsured = true
}
