import bcrypt from 'bcryptjs';
import { User } from '../../src/models/User';

jest.mock('bcryptjs');

describe('User Model Unit Tests', () => {
  it('should call bcrypt.compare with correct parameters', async () => {
    const mockCompare = bcrypt.compare as jest.Mock;
    mockCompare.mockResolvedValue(true);

    const user = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '1234567890',
      password: 'hashedpassword123',
    });

    const result = await user.comparePassword('candidatePass');

    expect(result).toBe(true);
    expect(mockCompare).toHaveBeenCalledWith('candidatePass', user.password);
  });
});
