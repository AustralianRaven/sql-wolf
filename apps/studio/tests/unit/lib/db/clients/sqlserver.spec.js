import { SqlServerChangeBuilder } from '@shared/lib/sql/change_builder/SqlServerChangeBuilder';
import { SQLServerClient } from '@/lib/db/clients/sqlserver';
import { DatabaseElement } from '@/lib/db/types';

describe("SQL Server alter table codegen", () => {


  it("Should generate basic changes", () => {
    const input = {
      table: 'foo', schema: 'public',
      adds: [
        { columnName: 'a', dataType: 'int'}
      ]
    }

    const builder = new SqlServerChangeBuilder('foo', 'public', [], [])

    const result = builder.alterTable(input)
    const expected = 'ALTER TABLE [public].[foo] ADD [a] int NOT NULL;'
    expect(result).toBe(expected)
  })

  it("Should alter a column name", () => {
    const input = {
      table: 'foo', schema: 'dbo',
      alterations: [
        {
          columnName: 'a', changeType: 'columnName', newValue: 'b'
        }
      ]
    }

    const builder = new SqlServerChangeBuilder('foo', 'dbo', [{columnName: 'a', dataType: 'int'}], [])
    const result = builder.alterTable(input)
    const expected = "EXEC sp_rename '[dbo].[foo].[a]', 'b', 'COLUMN';"
    expect(result).toBe(expected)

  })

  it("Should replace a default", () => {
    const input = {
      table: 'foo',
      schema: 'dbo',
      alterations: [
        {
          'columnName': 'a',
          changeType: 'defaultValue',
          newValue: "'something'"
        }
      ]
    }
    const defaultConstraints = [
      {
        name: "DF_foo",
        column: "a",
        schema: "dbo",
        table: 'foo'
      }
    ]
    const builder = new SqlServerChangeBuilder('foo', 'dbo', [], defaultConstraints)
    const result = builder.alterTable(input)
    const expected = 'ALTER TABLE [dbo].[foo] DROP CONSTRAINT [DF_foo], ADD DEFAULT \'something\' FOR [a];'
  })

  it("Should add a default constraint", () => {
    const input = {
      table: 'foo',
      schema: 'dbo',
      alterations: [
        {
          'columnName': 'a',
          changeType: 'defaultValue',
          newValue: null
        }
      ]
    }
    const defaultConstraints = []
    const builder = new SqlServerChangeBuilder('foo', 'dbo', [], defaultConstraints)
    const result = builder.alterTable(input)
    const expected = 'ALTER TABLE [dbo].[foo] ADD DEFAULT \'something\' FOR [a];'
  })

  it("Should drop a default constraint", () => {
    const input = {
      table: 'foo',
      schema: 'dbo',
      alterations: [
        {
          'columnName': 'a',
          changeType: 'defaultValue',
          newValue: null
        }
      ]
    }
    const defaultConstraints = [
      {
        name: "DF_foo",
        column: "a",
        schema: "dbo",
        table: 'foo'
      }
    ]
    const builder = new SqlServerChangeBuilder('foo', 'dbo', [], defaultConstraints)
    const result = builder.alterTable(input)
    const expected = 'ALTER TABLE [dbo].[foo] DROP CONSTRAINT [DF_foo];'
  })
})

describe("SQL Server qualified-name handling for dotted table names (#3722)", () => {
  function makeClient() {
    const server = { config: { readOnlyMode: false } }
    const database = { database: 'test' }
    const client = new SQLServerClient(server, database)
    // Swallow the real driver path entirely.
    client.driverExecuteSingle = jest.fn().mockResolvedValue({ data: { recordset: [] } })
    return client
  }

  it("listTableTriggers wraps schema and table in brackets before quoting", async () => {
    const client = makeClient()
    await client.listTableTriggers('Common.Companies', 'dbo')
    const sql = client.driverExecuteSingle.mock.calls[0][0]
    expect(sql).toBe("EXEC sp_helptrigger '[dbo].[Common.Companies]'")
  })

  it("getTableProperties sizeQuery wraps schema and table in brackets before quoting", async () => {
    const client = makeClient()
    client.listTableTriggers = jest.fn().mockResolvedValue([])
    client.listTableIndexes = jest.fn().mockResolvedValue([])
    client.getTableKeys = jest.fn().mockResolvedValue([])
    // getTableDescription is private; it still calls driverExecuteSingle, which is mocked.
    await client.getTableProperties('Common.Companies', 'dbo')
    const sqls = client.driverExecuteSingle.mock.calls.map((c) => c[0])
    const sizeQuery = sqls.find((s) => s.includes('sp_spaceused'))
    expect(sizeQuery).toBe("EXEC sp_spaceused N'[dbo].[Common.Companies]'; ")
  })

  it("setElementNameSql wraps a dotted element name correctly", async () => {
    const client = makeClient()
    const sql = await client.setElementNameSql(
      'Common.Companies', 'NewName', DatabaseElement.TABLE, 'dbo'
    )
    expect(sql).toBe("EXEC sp_rename '[dbo].[Common.Companies]', 'NewName';")
  })

  it("setElementNameSql still emits canonical bracketed form for simple names", async () => {
    const client = makeClient()
    const sql = await client.setElementNameSql(
      'foo', 'bar', DatabaseElement.TABLE, 'dbo'
    )
    expect(sql).toBe("EXEC sp_rename '[dbo].[foo]', 'bar';")
  })

  it("setElementNameSql doubles embedded closing brackets", async () => {
    const client = makeClient()
    const sql = await client.setElementNameSql(
      'weird]name', 'new', DatabaseElement.TABLE, 'dbo'
    )
    expect(sql).toBe("EXEC sp_rename '[dbo].[weird]]name]', 'new';")
  })

  describe("listDatabases", () => {

    // Inside a user database, sys.databases exposes only master and the current
    // database unless the login holds VIEW ANY DATABASE. On Azure SQL that is
    // documented behaviour and no grant changes it, which is why the dropdown
    // was empty until the user detoured through master. The list has to be read
    // from master itself.
    it("reads the list from a master connection", async () => {
      const client = makeClient()
      client.listDatabasesFromMaster = jest.fn().mockResolvedValue(['alpha', 'beta'])

      const result = await client.listDatabases()

      expect(client.listDatabasesFromMaster).toHaveBeenCalled()
      expect(result).toEqual(['alpha', 'beta'])
      // master answered, so the current connection is never asked.
      expect(client.driverExecuteSingle).not.toHaveBeenCalled()
    })

    it("falls back to the current connection when master is unreachable", async () => {
      const client = makeClient()
      client.listDatabasesFromMaster = jest.fn().mockResolvedValue(null)

      await client.listDatabases()

      expect(client.driverExecuteSingle).toHaveBeenCalledTimes(1)
    })

    it("gives the optional filter its own WHERE", async () => {
      const client = makeClient()
      client.listDatabasesFromMaster = jest.fn().mockResolvedValue(null)

      await client.listDatabases({ only: ['alpha', 'beta'] })
      const sql = client.driverExecuteSingle.mock.calls[0][0]

      // The filter used to be glued on as a bare AND with no WHERE above it,
      // which would have been a syntax error the moment anything passed one.
      expect(sql).toMatch(/WHERE/)
      expect(sql).not.toMatch(/sys\.databases\s+AND/)
      expect(sql).toContain("'alpha'")
    })

    it("does not filter on HAS_DBACCESS, which hides master", async () => {
      const client = makeClient()
      client.listDatabasesFromMaster = jest.fn().mockResolvedValue(null)

      await client.listDatabases()
      const sql = client.driverExecuteSingle.mock.calls[0][0]

      // HAS_DBACCESS returns NULL for master, so filtering on = 1 drops the one
      // database the user could always reach, leaving the dropdown empty.
      expect(sql).not.toContain('HAS_DBACCESS')
      expect(sql).not.toContain('AND')
    })
  })

  describe("executeQuery batching", () => {

    function makeQueryClient() {
      const client = makeClient()
      client.driverExecuteSingle = jest.fn().mockResolvedValue({
        data: { recordsets: [], recordset: [] },
        rowsAffected: 0,
      })
      return client
    }

    // Statements in one script share variables, temp tables and @@TRANCOUNT.
    // Splitting them into separate batches breaks all three; the loudest case
    // is a BEGIN whose COMMIT lands in the next batch, which SQL Server answers
    // with "Transaction count after EXECUTE indicates a mismatching number of
    // BEGIN and COMMIT statements".
    const script = [
      'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED',
      '',
      'BEGIN TRANSACTION;',
      '',
      'DECLARE @item NVARCHAR(MAX)',
      "SET @item = '%RN-1%'",
      '',
      'SELECT TOP 100 * FROM Workflow.WorkItem WHERE Title LIKE @item',
      '',
      'COMMIT TRANSACTION;',
    ].join('\n')

    it("sends a transaction script as a single batch", async () => {
      const client = makeQueryClient()
      await client.executeQuery(script, { tabId: 1 })

      expect(client.driverExecuteSingle).toHaveBeenCalledTimes(1)
      const sent = client.driverExecuteSingle.mock.calls[0][0]
      expect(sent).toContain('BEGIN TRANSACTION')
      expect(sent).toContain('COMMIT TRANSACTION')
      expect(sent).toContain('DECLARE @item')
    })

    it("keeps a declared variable in the same batch as its use", async () => {
      const client = makeQueryClient()
      await client.executeQuery('DECLARE @x INT;\nSET @x = 1;\nSELECT @x;', { tabId: 1 })

      expect(client.driverExecuteSingle).toHaveBeenCalledTimes(1)
      expect(client.driverExecuteSingle.mock.calls[0][0]).toContain('DECLARE @x')
    })

    it("still runs statement by statement when a transaction must be intercepted", async () => {
      const client = makeQueryClient()
      client.startTransaction = jest.fn().mockResolvedValue(undefined)
      client.commitTransaction = jest.fn().mockResolvedValue(undefined)

      // Bare BEGIN/COMMIT are what the identifier recognises as TRANSACTION,
      // which is the path manual commit mode depends on.
      client.identifyCommands = jest.fn().mockReturnValue([
        { text: 'BEGIN', type: 'BEGIN_TRANSACTION', executionType: 'TRANSACTION' },
        { text: 'SELECT 1', type: 'SELECT', executionType: 'LISTING' },
        { text: 'COMMIT', type: 'COMMIT', executionType: 'TRANSACTION' },
      ])

      await client.executeQuery('BEGIN; SELECT 1; COMMIT;', { tabId: 1 })

      expect(client.startTransaction).toHaveBeenCalledWith(1)
      expect(client.commitTransaction).toHaveBeenCalledWith(1)
      // Only the SELECT reaches the driver; the transaction statements are
      // routed to the reserved connection instead.
      expect(client.driverExecuteSingle).toHaveBeenCalledTimes(1)
      expect(client.driverExecuteSingle.mock.calls[0][0]).toBe('SELECT 1')
    })

    it("does not intercept transactions when there is no tab to own them", async () => {
      const client = makeQueryClient()
      client.startTransaction = jest.fn()
      client.identifyCommands = jest.fn().mockReturnValue([
        { text: 'BEGIN', type: 'BEGIN_TRANSACTION', executionType: 'TRANSACTION' },
      ])

      await client.executeQuery('BEGIN;', {})

      expect(client.startTransaction).not.toHaveBeenCalled()
      expect(client.driverExecuteSingle).toHaveBeenCalledTimes(1)
    })
  })
})