const request = require('supertest');
const { app } = require('./server');
const db = require('./db');
const jwt = require('jsonwebtoken');

jest.mock('./db');

describe('POST /api/shifts/week', () => {
    let token;

    beforeAll(() => {
        // Create a valid token to bypass authenticateToken
        token = jwt.sign({ id: 1, username: 'admin' }, process.env.JWT_SECRET || 'roster-secret-key-123');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should delete shifts when deleteShifts array is provided', async () => {
        const tx = {
            run: jest.fn().mockResolvedValue({ changes: 2 })
        };
        db.transaction.mockImplementation(async (callback) => {
            await callback(tx);
        });

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                deleteShifts: [1, 2]
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledWith(
            'DELETE FROM shifts WHERE id IN (?,?)',
            [1, 2]
        );
    });

    it('should insert new shift when s.id starts with "new_"', async () => {
        const tx = {
            get: jest.fn().mockResolvedValue({ id: 10 }), // member_id
            run: jest.fn().mockResolvedValue({ insertId: 5 })
        };
        db.transaction.mockImplementation(async (callback) => {
            await callback(tx);
        });

        const newShift = {
            id: 'new_123',
            name: 'John Doe',
            storeId: 1,
            date: '2023-10-10',
            startTime: '09:00',
            endTime: '17:00',
            duration: 8
        };

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                saveShifts: [newShift]
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(tx.get).toHaveBeenCalledTimes(1);
        expect(tx.get).toHaveBeenCalledWith(
            'SELECT m.id FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE m.name = ? AND ms.store_id = ?',
            ['John Doe', 1]
        );
        expect(tx.run).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledWith(
            'INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [1, 10, 'John Doe', '2023-10-10', '09:00', '17:00', 8]
        );
    });

    it('should insert new shift when s.id is missing or invalid', async () => {
        const tx = {
            get: jest.fn().mockResolvedValue({ id: 11 }), // member_id
            run: jest.fn().mockResolvedValue({ insertId: 6 })
        };
        db.transaction.mockImplementation(async (callback) => {
            await callback(tx);
        });

        const shiftMissingId = {
            name: 'Jane Doe',
            storeId: 2,
            date: '2023-10-11',
            startTime: '10:00',
            endTime: '14:00',
            duration: 4
        };

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                saveShifts: [shiftMissingId]
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(tx.get).toHaveBeenCalledTimes(1);
        expect(tx.get).toHaveBeenCalledWith(
            'SELECT m.id FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE m.name = ? AND ms.store_id = ?',
            ['Jane Doe', 2]
        );
        expect(tx.run).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledWith(
            'INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [2, 11, 'Jane Doe', '2023-10-11', '10:00', '14:00', 4]
        );
    });

    it('should not insert new shift if member is not found', async () => {
        const tx = {
            get: jest.fn().mockResolvedValue(null), // member_id not found
            run: jest.fn()
        };
        db.transaction.mockImplementation(async (callback) => {
            await callback(tx);
        });

        const newShift = {
            id: 'new_456',
            name: 'Unknown User',
            storeId: 1,
            date: '2023-10-10',
            startTime: '09:00',
            endTime: '17:00',
            duration: 8
        };

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                saveShifts: [newShift]
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(tx.get).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledTimes(0); // Insert should not be called
    });

    it('should update existing shift when s.id is a number', async () => {
        const tx = {
            run: jest.fn().mockResolvedValue({ changes: 1 })
        };
        db.transaction.mockImplementation(async (callback) => {
            await callback(tx);
        });

        const updateShift = {
            id: 99,
            startTime: '08:00',
            endTime: '16:00',
            duration: 8
        };

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                saveShifts: [updateShift]
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(tx.run).toHaveBeenCalledTimes(1);
        expect(tx.run).toHaveBeenCalledWith(
            'UPDATE shifts SET start_time = ?, end_time = ?, duration = ? WHERE id = ?',
            ['08:00', '16:00', 8, 99]
        );
    });

    it('should return 500 when db.transaction throws an error', async () => {
        db.transaction.mockRejectedValue(new Error('Database transaction failed'));

        const res = await request(app)
            .post('/api/shifts/week')
            .set('Authorization', `Bearer ${token}`)
            .send({
                deleteShifts: [1]
            });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Database transaction failed' });
    });
});
