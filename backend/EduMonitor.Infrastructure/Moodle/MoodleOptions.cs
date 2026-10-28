namespace EduMonitor.Infrastructure.Moodle;
public sealed class MoodleOptions
{
    public const string Section = "Moodle";
    public string BaseUrl { get; set; } = "http://localhost:8080";
    public string MoodleToken { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 30;
    public int MaxRetries { get; set; } = 2;
    public bool CourseDueDatesAreAuthoritative { get; set; } = false;
    public string[] TeacherRoles { get; set; } = ["editingteacher", "teacher"];
    public string[] StudentRoles { get; set; } = ["student"];
}
public sealed class MoodleException(string code, string message, int httpStatus = 502) : Exception(message)
{
    public string Code { get; } = code;
    public int HttpStatus { get; } = httpStatus;
}
