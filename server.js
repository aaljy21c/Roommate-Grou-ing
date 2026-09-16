require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 캐시 방지 미들웨어 추가
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// DB 설정
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const studentsData = [
    { id: '20101', name: '강호연' },
    { id: '20102', name: '김민석' },
    { id: '20103', name: '김민재' },
    { id: '20104', name: '김민찬' },
    { id: '20105', name: '김선범' },
    { id: '20106', name: '김시윤' },
    { id: '20107', name: '김은우' },
    { id: '20108', name: '김준태' },
    { id: '20109', name: '김진성' },
    { id: '20110', name: '박성빈' },
    { id: '20111', name: '원종혁' },
    { id: '20112', name: '유수성' },
    { id: '20113', name: '유희성' },
    { id: '20114', name: '이건호' },
    { id: '20116', name: '이민재' },
    { id: '20117', name: '이승민' },
    { id: '20118', name: '이시우' },
    { id: '20119', name: '이정민' },
    { id: '20120', name: '이정우' },
    { id: '20121', name: '이화준' },
    { id: '20122', name: '임진우' },
    { id: '20123', name: '장신후' },
    { id: '20124', name: '정민규' },
    { id: '20126', name: '최강' },
    { id: '20127', name: '최민' },
    { id: '20128', name: '최민혁' },
    { id: '20129', name: '최인혁' },
    { id: '20130', name: '홍준화' }
];

const birthdates = {
    '강호연': '0910',
    '김민석': '1211',
    '김민재': '0121',
    '김민찬': '1116',
    '김선범': '0105',
    '김시윤': '0220',
    '김은우': '1224',
    '김준태': '0207',
    '김진성': '0218',
    '박성빈': '1006',
    '원종혁': '0811',
    '유수성': '1107',
    '유희성': '0420',
    '이건호': '0617',
    '이민재': '0728',
    '이승민': '0807',
    '이시우': '1013',
    '이정민': '1201',
    '이정우': '0131',
    '이화준': '0225',
    '임진우': '0601',
    '장신후': '0528',
    '정민규': '0718',
    '최강': '1217',
    '최민': '0722',
    '최민혁': '0604',
    '최인혁': '1211',
    '홍준화': '0327'
};

async function initDB() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS rooms (
            id SERIAL PRIMARY KEY,
            type INTEGER NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS room_members (
            room_id INTEGER,
            student_id TEXT,
            FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )`);

        // 기존 데이터 초기화 후 재삽입 (명단이 추가/변경되었으므로 확실하게 처리)
        await pool.query("DELETE FROM students");
        for (const student of studentsData) {
            await pool.query("INSERT INTO students (id, name) VALUES ($1, $2)", [student.id, student.name]);
        }
        console.log("PostgreSQL Database initialized.");
    } catch (err) {
        console.error("Failed to initialize database:", err);
    }
}

// DB 초기화 실행
if (process.env.DATABASE_URL) {
    initDB();
} else {
    console.warn("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
}

// API 엔드포인트
app.get('/api/status', async (req, res) => {
    try {
        const studentsResult = await pool.query("SELECT id, name FROM students");
        const allStudents = studentsResult.rows;
        
        const roomsResult = await pool.query(`
            SELECT rooms.id, rooms.type, rooms.created_at, rooms.updated_at, room_members.student_id 
            FROM rooms 
            LEFT JOIN room_members ON rooms.id = room_members.room_id
        `);
        const rows = roomsResult.rows;

        const rooms = {};
        let assignedStudentIds = new Set();
        let twoPersonCount = 0;
        let threePersonCount = 0;

        rows.forEach(row => {
            if (!rooms[row.id]) {
                rooms[row.id] = {
                    id: row.id,
                    type: row.type,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    members: []
                };
                if (row.type === 2) twoPersonCount++;
                if (row.type === 3) threePersonCount++;
            }
            if (row.student_id) {
                rooms[row.id].members.push(row.student_id);
                assignedStudentIds.add(row.student_id);
            }
        });

        const students = allStudents.map(s => ({
            ...s,
            assigned: assignedStudentIds.has(s.id)
        }));

        res.json({
            students,
            rooms: Object.values(rooms),
            stats: {
                twoPersonRooms: twoPersonCount,
                threePersonRooms: threePersonCount,
                twoPersonMax: 2,
                threePersonMax: 8
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/room', async (req, res) => {
    const { type, password, birthdate, members } = req.body; 

    if (![2, 3].includes(type)) return res.status(400).json({ error: '방 타입이 잘못되었습니다.' });
    if (!members || members.length !== type) {
        return res.status(400).json({ error: `해당 방은 ${type}명을 선택해야 합니다.` });
    }

    if (password !== 'a1357') {
        if (!/^[0-9]{5}$/.test(password)) {
            return res.status(400).json({ error: '비밀번호는 5자리 숫자여야 합니다.' });
        }
        if (!birthdate || !/^[0-9]{4}$/.test(birthdate)) {
            return res.status(400).json({ error: '생년월일은 4자리 숫자여야 합니다. (예: 0101)' });
        }

        // 선택된 학생 중에 입력한 생년월일과 일치하는 학생이 있는지 확인
        const selectedStudents = studentsData.filter(s => members.includes(s.id));
        const isValidBirthdate = selectedStudents.some(s => birthdates[s.name] === birthdate);
        
        if (!isValidBirthdate) {
            return res.status(400).json({ error: '선택한 인원 중에 입력하신 생년월일(4자리)과 일치하는 학생이 없습니다. 본인을 반드시 포함해주세요.' });
        }
    }

    try {
        const countRes = await pool.query("SELECT COUNT(*) AS count FROM rooms WHERE type = $1", [type]);
        const typeCount = parseInt(countRes.rows[0].count, 10);
        if (type === 2 && typeCount >= 2) return res.status(400).json({ error: '2인실이 가득 찼습니다.' });
        if (type === 3 && typeCount >= 8) return res.status(400).json({ error: '3인실이 가득 찼습니다.' });

        const placeholders = members.map((_, i) => `$${i + 1}`).join(',');
        const membersCheck = await pool.query(`SELECT COUNT(*) AS count FROM room_members WHERE student_id IN (${placeholders})`, members);
        if (parseInt(membersCheck.rows[0].count, 10) > 0) return res.status(400).json({ error: '이미 방이 배정된 학생이 포함되어 있습니다.' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertRoomRes = await client.query(
                "INSERT INTO rooms (type, password, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id",
                [type, password]
            );
            const roomId = insertRoomRes.rows[0].id;

            for (const member of members) {
                await client.query("INSERT INTO room_members (room_id, student_id) VALUES ($1, $2)", [roomId, member]);
            }
            await client.query('COMMIT');
            res.json({ success: true, roomId });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/room/:id', async (req, res) => {
    const { id } = req.params;
    const { oldPassword, newPassword, birthdate, members } = req.body;

    if (!oldPassword || !newPassword) return res.status(400).json({ error: '비밀번호가 필요합니다.' });

    try {
        const roomRes = await pool.query("SELECT password, type FROM rooms WHERE id = $1", [id]);
        if (roomRes.rows.length === 0) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        const row = roomRes.rows[0];

        if (oldPassword !== 'a1357') {
            if (row.password !== oldPassword) {
                return res.status(401).json({ error: '배정시 비번과 일치하지 않습니다.' });
            }
            if (!/^[0-9]{5}$/.test(newPassword)) {
                return res.status(400).json({ error: '새 비밀번호는 5자리 숫자여야 합니다.' });
            }
            if (!birthdate || !/^[0-9]{4}$/.test(birthdate)) {
                return res.status(400).json({ error: '생년월일은 4자리 숫자여야 합니다. (예: 0101)' });
            }
            
            const selectedStudents = studentsData.filter(s => members.includes(s.id));
            const isValidBirthdate = selectedStudents.some(s => birthdates[s.name] === birthdate);
            
            if (!isValidBirthdate) {
                return res.status(400).json({ error: '선택한 인원 중에 입력하신 생년월일(4자리)과 일치하는 학생이 없습니다.' });
            }
        }

        if (members.length !== row.type) {
            return res.status(400).json({ error: `해당 방은 ${row.type}명을 선택해야 합니다.` });
        }

        const placeholders = members.map((_, i) => `$${i + 1}`).join(',');
        const queryParams = [...members, id];
        const countRes = await pool.query(`SELECT COUNT(*) AS count FROM room_members WHERE student_id IN (${placeholders}) AND room_id != $${members.length + 1}`, queryParams);
        if (parseInt(countRes.rows[0].count, 10) > 0) return res.status(400).json({ error: '이미 다른 방에 배정된 학생이 포함되어 있습니다.' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM room_members WHERE room_id = $1", [id]);
            for (const member of members) {
                await client.query("INSERT INTO room_members (room_id, student_id) VALUES ($1, $2)", [id, member]);
            }
            const finalPassword = (oldPassword === 'a1357' && newPassword === 'a1357') ? row.password : newPassword;
            await client.query("UPDATE rooms SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [finalPassword, id]);
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/room/:id/verify', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ error: '비밀번호가 필요합니다.' });

    try {
        const roomRes = await pool.query("SELECT password FROM rooms WHERE id = $1", [id]);
        if (roomRes.rows.length === 0) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        const row = roomRes.rows[0];

        if (password !== 'a1357' && row.password !== password) {
            return res.status(401).json({ error: '배정시 비번과 일치하지 않습니다.' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/room/:id', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body; 

    if (!password) return res.status(400).json({ error: '비밀번호가 필요합니다.' });

    try {
        const roomRes = await pool.query("SELECT password FROM rooms WHERE id = $1", [id]);
        if (roomRes.rows.length === 0) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        const row = roomRes.rows[0];

        if (password !== 'a1357' && row.password !== password) {
            return res.status(401).json({ error: '배정시 비번과 일치하지 않습니다.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM room_members WHERE room_id = $1", [id]);
            await client.query("DELETE FROM rooms WHERE id = $1", [id]);
            await client.query('COMMIT');
            res.json({ success: true });
        } catch(e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reset', async (req, res) => {
    const { password } = req.body;
    
    if (password !== 'a1357') {
        return res.status(401).json({ error: '마스터키가 일치하지 않습니다. 선생님만 초기화할 수 있습니다.' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM room_members");
            await client.query("DELETE FROM rooms");
            await client.query('COMMIT');
            res.json({ success: true });
        } catch(e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
