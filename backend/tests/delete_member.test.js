const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../db.js', () => ({
    run: jest.fn()
}));
jest.mock('jsonwebtoken');

const { app } = require('../server.js');
const db = require('../db.js');

describe('DELETE /api/members/:id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default successful auth mock
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, { id: 1, username: 'admin', role: 'admin' });
        });
    });

    it('should delete a member and return success when authenticated', async () => {
        // Mock successful DB run
        db.run.mockResolvedValue({ changes: 1 });

        const response = await request(app)
            .delete('/api/members/123')
            .set('Authorization', 'Bearer valid_token');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, deleted: 1 });
        expect(db.run).toHaveBeenCalledWith('DELETE FROM members WHERE id = ?', ['123']);
        expect(db.run).toHaveBeenCalledTimes(1);
    });

    it('should return 401 when missing authentication token', async () => {
        const response = await request(app)
            .delete('/api/members/123');

        expect(response.status).toBe(401);
        expect(db.run).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', async () => {
        // Setup failing auth mock
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(new Error('invalid token'), null);
        });

        const response = await request(app)
            .delete('/api/members/123')
            .set('Authorization', 'Bearer invalid_token');

        expect(response.status).toBe(403);
        expect(db.run).not.toHaveBeenCalled();
    });

    it('should handle zero deleted records (member not found)', async () => {
        // Mock DB run with zero changes
        db.run.mockResolvedValue({ changes: 0 });

        const response = await request(app)
            .delete('/api/members/999')
            .set('Authorization', 'Bearer valid_token');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, deleted: 0 });
        expect(db.run).toHaveBeenCalledWith('DELETE FROM members WHERE id = ?', ['999']);
    });

    it('should handle database errors gracefully', async () => {
        // Mock DB run throwing an error
        db.run.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
            .delete('/api/members/123')
            .set('Authorization', 'Bearer valid_token');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Database error' });
        expect(db.run).toHaveBeenCalledWith('DELETE FROM members WHERE id = ?', ['123']);
    });
});
