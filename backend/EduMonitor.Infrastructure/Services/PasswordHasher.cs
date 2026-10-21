using System.Security.Cryptography;
using EduMonitor.Core.Services;

namespace EduMonitor.Infrastructure.Services;

public class PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 50000;
    private static readonly HashAlgorithmName Algorithm = HashAlgorithmName.SHA256;

    public string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, Algorithm, KeySize);
        return $"{Convert.ToHexString(salt)}-{Convert.ToHexString(hash)}";
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        var parts = passwordHash.Split('-');
        if (parts.Length != 2) return false;

        byte[] salt = Convert.FromHexString(parts[0]);
        byte[] hash = Convert.FromHexString(parts[1]);

        byte[] testHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, Algorithm, KeySize);
        return CryptographicOperations.FixedTimeEquals(hash, testHash);
    }
}
