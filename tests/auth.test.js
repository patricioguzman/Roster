const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../backend/server.js');

describe('authenticateToken middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            headers: {}
        };
        mockRes = {
            sendStatus: jest.fn()
        };
        mockNext = jest.fn();
    });

    it('should return 401 if no authorization header is present', () => {
        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.sendStatus).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is present but no token is provided', () => {
        mockReq.headers['authorization'] = 'Bearer';
        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.sendStatus).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header format is invalid (no space)', () => {
        mockReq.headers['authorization'] = 'BearerToken123';
        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.sendStatus).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if token is invalid', () => {
        mockReq.headers['authorization'] = 'Bearer invalid-token';
        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.sendStatus).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if token is expired', () => {
        // Create an expired token
        const expiredToken = jwt.sign({ id: 1, username: 'test' }, 'roster-secret-key-123', { expiresIn: '-1h' });
        mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.sendStatus).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() and set req.user if token is valid', () => {
        // Create a valid token
        const validUser = { id: 1, username: 'testuser' };
        const validToken = jwt.sign(validUser, 'roster-secret-key-123');
        mockReq.headers['authorization'] = `Bearer ${validToken}`;

        authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.sendStatus).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.id).toBe(validUser.id);
        expect(mockReq.user.username).toBe(validUser.username);
    });
});
