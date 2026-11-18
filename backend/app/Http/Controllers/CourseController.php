<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Courses (subjects) taught in each semester of a program.
 * Used by the timetable editor. Tenant scope applies through route model binding.
 */
class CourseController extends Controller
{
    // GET /api/programs/{program}/courses  (optional ?semester_no=1)
    public function index(Request $request, Program $program)
    {
        $courses = Course::where('program_id', $program->id)
            ->when($request->filled('semester_no'), fn ($q) => $q->where('semester_no', (int) $request->semester_no))
            ->withCount('timetableEntries')
            ->orderBy('semester_no')->orderBy('code')
            ->get();

        return response()->json([
            'program' => $program->only(['id', 'name', 'code', 'total_semesters']),
            'courses' => $courses,
        ]);
    }

    // POST /api/programs/{program}/courses
    public function store(Request $request, Program $program)
    {
        $data = $this->validated($request, $program);
        $course = Course::create($data + ['program_id' => $program->id]);

        return response()->json($course, 201);
    }

    // PUT /api/courses/{course}
    public function update(Request $request, Course $course)
    {
        $data = $this->validated($request, $course->program, $course);
        $course->update($data);

        return response()->json($course->fresh());
    }

    // DELETE /api/courses/{course}
    public function destroy(Course $course)
    {
        $used = $course->timetableEntries()->count();
        if ($used > 0) {
            return response()->json([
                'message' => "This course has {$used} class(es) on the timetable. Remove them first, or mark the course inactive.",
            ], 422);
        }

        $course->delete();

        return response()->json(['message' => 'Course deleted.']);
    }

    private function validated(Request $request, Program $program, ?Course $course = null): array
    {
        $data = $request->validate([
            'semester_no'  => ['required', 'integer', 'min:1', 'max:' . max(1, (int) $program->total_semesters)],
            'code'         => [
                'required', 'string', 'max:30',
                Rule::unique('courses', 'code')->where('program_id', $program->id)->ignore($course?->id),
            ],
            'title'        => 'required|string|max:255',
            'credit_hours' => 'nullable|numeric|min:0|max:20',
            'is_active'    => 'boolean',
        ], [
            'code.unique'     => 'This program already has a course with this code.',
            'semester_no.max' => "This program has {$program->total_semesters} semester(s).",
        ]);

        $data['code'] = strtoupper(trim($data['code']));
        $data['title'] = trim($data['title']);

        return $data;
    }
}
