const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_CONFIG = {
  user: 'crleid',
  password: '14024451',
  connectString: 'localhost:1521/XEPDB1'
};

async function query(sql, binds = [], opts = {}) {
  const conn = await oracledb.getConnection(DB_CONFIG);
  try {
    opts.outFormat = oracledb.OUT_FORMAT_OBJECT;
    const result = await conn.execute(sql, binds, opts);
    return result;
  } finally {
    await conn.close();
  }
}

// --- CRIMES ---
app.get('/api/crimes', async (req, res) => {
  const r = await query(`SELECT * FROM vw_Crime_Intelligence ORDER BY CrimeID`);
  res.json(r.rows);
});

app.post('/api/crimes', async (req, res) => {
  const { stationId, crimeType, crimeDate, location, severity, complainantName, officerId } = req.body;
  const conn = await oracledb.getConnection(DB_CONFIG);
  try {
    // Insert crime
    const crimeRes = await conn.execute(
      `INSERT INTO Crime VALUES (seq_crime.NEXTVAL, :sid, :ct, TO_DATE(:cd,'YYYY-MM-DD'), :loc, NULL, :sev, 'Reported') RETURNING CrimeID INTO :cid`,
      { sid: stationId, ct: crimeType, cd: crimeDate, loc: location, sev: severity, cid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      { autoCommit: false }
    );
    const crimeId = crimeRes.outBinds.cid[0];
    const firNum = `FIR/AUTO/${Date.now()}`;
    await conn.execute(
      `INSERT INTO FIR VALUES (seq_fir.NEXTVAL, :cid, :fnum, SYSDATE, :oid, :comp, NULL, 'Open')`,
      { cid: crimeId, fnum: firNum, oid: officerId, comp: complainantName },
      { autoCommit: false }
    );
    await conn.commit();
    res.json({ success: true, crimeId, firNumber: firNum });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message });
  } finally {
    await conn.close();
  }
});

// --- SUSPECTS ---
app.get('/api/suspects', async (req, res) => {
  const r = await query(`
    SELECT s.*, fn_Recidivism_Score(s.SuspectID) AS RecidivismScore FROM Suspects s ORDER BY SuspectID
  `);
  res.json(r.rows);
});

app.post('/api/suspects', async (req, res) => {
  const { name, dob, address, nationalId, priorConvictions } = req.body;
  const risk = priorConvictions == 0 ? 'LOW' : priorConvictions <= 2 ? 'MEDIUM' : 'HIGH';
  try {
    await query(
      `INSERT INTO Suspects VALUES (seq_suspect.NEXTVAL,:n,TO_DATE(:d,'YYYY-MM-DD'),:a,:nid,:pc,:r)`,
      [name, dob || null, address, nationalId, priorConvictions, risk],
      { autoCommit: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- OFFICERS ---
app.get('/api/officers', async (req, res) => {
  const r = await query(`SELECT * FROM vw_Officer_Workload ORDER BY OfficerID`);
  res.json(r.rows);
});

// --- STATIONS ---
app.get('/api/stations', async (req, res) => {
  const r = await query(`SELECT * FROM Police_Station ORDER BY StationID`);
  res.json(r.rows);
});

// --- CASES ---
app.get('/api/cases', async (req, res) => {
  const r = await query(`
    SELECT cf.CaseID, cf.CaseStatus, cf.AssignedOfficerID,
           f.FIRNumber, c.CrimeType, c.Severity, o.Name AS OfficerName
    FROM CaseFile cf
    JOIN FIR f ON cf.FIRID = f.FIRID
    JOIN Crime c ON f.CrimeID = c.CrimeID
    LEFT JOIN Officers o ON cf.AssignedOfficerID = o.OfficerID
    ORDER BY cf.CaseID
  `);
  res.json(r.rows);
});

app.put('/api/cases/:id/assign', async (req, res) => {
  const { officerId } = req.body;
  try {
    await query(
      `UPDATE CaseFile SET AssignedOfficerID = :oid WHERE CaseID = :cid`,
      [officerId, req.params.id],
      { autoCommit: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- AUDIT LOG ---
app.get('/api/auditlog', async (req, res) => {
  const r = await query(`
    SELECT l.*, o.Name AS OfficerName
    FROM Officer_Assignment_Log l
    LEFT JOIN Officers o ON l.OfficerID = o.OfficerID
    ORDER BY AssignedAt DESC FETCH FIRST 20 ROWS ONLY
  `);
  res.json(r.rows);
});

// --- ANALYTICS ---
app.get('/api/analytics/rank', async (req, res) => {
  const r = await query(`
    SELECT ps.StationName, ps.District, COUNT(c.CrimeID) AS TotalCrimes,
           RANK() OVER (ORDER BY COUNT(c.CrimeID) DESC) AS CrimeRank
    FROM Crime c JOIN Police_Station ps ON c.StationID = ps.StationID
    GROUP BY ps.StationName, ps.District ORDER BY CrimeRank
  `);
  res.json(r.rows);
});

app.get('/api/analytics/listagg', async (req, res) => {
  const r = await query(`
    SELECT c.CrimeID, c.CrimeType,
           LISTAGG(s.Name, ', ') WITHIN GROUP (ORDER BY s.Name) AS SuspectNames
    FROM Crime c JOIN Crime_Suspect cs ON c.CrimeID = cs.CrimeID
    JOIN Suspects s ON cs.SuspectID = s.SuspectID
    GROUP BY c.CrimeID, c.CrimeType
  `);
  res.json(r.rows);
});

app.get('/api/analytics/running', async (req, res) => {
  const r = await query(`
    SELECT ps.District, TO_CHAR(c.CrimeDate,'YYYY-MM-DD') AS CrimeDate, c.CrimeType,
           COUNT(*) OVER (PARTITION BY ps.District ORDER BY c.CrimeDate
                          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningCount
    FROM Crime c JOIN Police_Station ps ON c.StationID = ps.StationID
    ORDER BY ps.District, c.CrimeDate
  `);
  res.json(r.rows);
});

app.listen(3000, () => console.log('CRLEID server running at http://localhost:3000'));