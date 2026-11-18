<?php

namespace App\Http\Controllers;

use App\Models\AcademicTerm;
use App\Models\Application;
use App\Models\Course;
use App\Models\Program;
use App\Models\TimetableEntry;
use App\Models\TimetablePeriod;
use App\Services\TimetableService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Class timetable editor (college admin).
 * One grid per academic term + program + semester + shift: rows = periods of that shift, columns = working days.
 * Shifts / days come from Settings → Timetable (settings `shifts`, `timetable_days`).
 */
class TimetableController extends Controller
{
    // GET /api/timetable?term_id=&program_id=&semester_no=&shift=
    // Without program_id it returns only the pickers (terms, programs, shifts, days).
    // Without term_id the current term is used.
    public function index(Request $request)
    {
        $shifts = $this->enabledShifts();
        $term   = $request->filled('term_id')
            ? AcademicTerm::find($request->term_id)
            : (AcademicTerm::current() ?? AcademicTerm::orderByDesc('start_date')->first());

        $payload = [
            'terms'    => AcademicTerm::orderByDesc('start_date')->get(['id', 'name', 'start_date', 'end_date', 'is_current']),
            'term'     => $term?->only(['id', 'name', 'is_current']),
            'programs' => Program::where('is_active', true)->orderBy('name')
                ->get(['id', 'name', 'code', 'total_semesters']),
            'shifts'   => collect($shifts)->map(fn ($k) => ['key' => $k, 'label' => config("timetable.shifts.$k")])->values(),
            'days'     => collect($this->workingDays())->map(fn ($d) => ['key' => $d, 'label' => config("timetable.days.$d")])->values(),
        ];

        if (!$request->filled('program_id') || !$term) {
            return response()->json($payload);
        }

        $request->validate([
            'program_id'  => 'required|integer',
            'semester_no' => 'required|integer|min:1|max:20',
            'shift'       => ['required', Rule::in($shifts)],
        ]);

        $program = Program::findOrFail($request->program_id);   // tenant scope applies

        return response()->json($payload + [
            'program'  => $program->only(['id', 'name', 'code', 'total_semesters']),
            'periods'  => $this->periodsFor($request->shift),
            'courses'  => Course::where('program_id', $program->id)
                ->where('semester_no', $request->semester_no)
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'title', 'credit_hours']),
            'entries'  => TimetableEntry::with('course:id,code,title')
                ->where('academic_term_id', $term->id)
                ->where('program_id', $program->id)
                ->where('semester_no', $request->semester_no)
                ->where('shift', $request->shift)
                ->get(),
        ]);
    }

    // POST /api/timetable — create or replace one cell of the grid.
    public function save(Request $request)
    {
        $data = $request->validate([
            'academic_term_id'    => 'required|integer',
            'program_id'          => 'required|integer',
            'semester_no'         => 'required|integer|min:1|max:20',
            'shift'               => ['required', Rule::in($this->enabledShifts())],
            'day'                 => ['required', 'integer', Rule::in($this->workingDays())],
            'timetable_period_id' => 'required|integer',
            'course_id'           => 'required|integer',
            'teacher_name'        => 'nullable|string|max:100',
            'room'                => 'nullable|string|max:50',
        ], [
            'day.in'   => 'That day is not a working day (Settings → Timetable).',
            'shift.in' => 'That shift is not enabled (Settings → Timetable).',
        ]);

        // All lookups go through the tenant scope, so ids from another college are "not found".
        if (!AcademicTerm::find($data['academic_term_id'])) {
            throw ValidationException::withMessages(['academic_term_id' => 'Choose an academic term.']);
        }
        $program = Program::findOrFail($data['program_id']);
        if ($data['semester_no'] > $program->total_semesters) {
            throw ValidationException::withMessages(['semester_no' => "This program has {$program->total_semesters} semester(s)."]);
        }

        $period = TimetablePeriod::find($data['timetable_period_id']);
        if (!$period || $period->shift !== $data['shift']) {
            throw ValidationException::withMessages(['timetable_period_id' => 'Choose a period of this shift.']);
        }
        if ($period->is_break) {
            throw ValidationException::withMessages(['timetable_period_id' => "\"{$period->name}\" is a break."]);
        }

        $course = Course::where('id', $data['course_id'])
            ->where('program_id', $program->id)
            ->where('semester_no', $data['semester_no'])
            ->where('is_active', true)
            ->first();
        if (!$course) {
            throw ValidationException::withMessages(['course_id' => 'Choose an active course of this program semester.']);
        }

        $data['teacher_name'] = $this->clean($data['teacher_name'] ?? null);
        $data['room']         = $this->clean($data['room'] ?? null);

        $this->checkClashes($data, $period);

        $entry = TimetableEntry::updateOrCreate(
            [
                'academic_term_id'    => $data['academic_term_id'],
                'program_id'          => $program->id,
                'semester_no'         => $data['semester_no'],
                'shift'               => $data['shift'],
                'day'                 => $data['day'],
                'timetable_period_id' => $period->id,
            ],
            [
                'course_id'    => $course->id,
                'teacher_name' => $data['teacher_name'],
                'room'         => $data['room'],
            ]
        );

        return response()->json($entry->load('course:id,code,title'), $entry->wasRecentlyCreated ? 201 : 200);
    }

    // POST /api/timetable/copy — copy one grid (program + semester + shift) from another term
    // into the chosen term. Filled cells, inactive courses and teacher/room clashes are skipped.
    public function copy(Request $request)
    {
        $data = $request->validate([
            'from_term_id' => 'required|integer|different:to_term_id',
            'to_term_id'   => 'required|integer',
            'program_id'   => 'required|integer',
            'semester_no'  => 'required|integer|min:1|max:20',
            'shift'        => ['required', Rule::in($this->enabledShifts())],
        ], [
            'from_term_id.different' => 'Choose a different term to copy from.',
        ]);

        $from    = AcademicTerm::findOrFail($data['from_term_id']);
        $to      = AcademicTerm::findOrFail($data['to_term_id']);
        $program = Program::findOrFail($data['program_id']);

        $source = TimetableEntry::with(['course', 'period'])
            ->where('academic_term_id', $from->id)
            ->where('program_id', $program->id)
            ->where('semester_no', $data['semester_no'])
            ->where('shift', $data['shift'])
            ->get();

        $copied = 0;
        $skipped = [];
        foreach ($source as $e) {
            $where = sprintf('%s %s', config("timetable.days.{$e->day}"), $e->period->name);
            $cell = [
                'academic_term_id'    => $to->id,
                'program_id'          => $program->id,
                'semester_no'         => $data['semester_no'],
                'shift'               => $data['shift'],
                'day'                 => $e->day,
                'timetable_period_id' => $e->timetable_period_id,
            ];

            if (TimetableEntry::where($cell)->exists()) {
                $skipped[] = "{$where}: already filled";
                continue;
            }
            if (!$e->course || !$e->course->is_active || $e->period->is_break || !in_array($e->day, $this->workingDays())) {
                $skipped[] = "{$where}: course, period or day no longer in use";
                continue;
            }
            try {
                $this->checkClashes($cell + ['teacher_name' => $e->teacher_name, 'room' => $e->room], $e->period);
            } catch (ValidationException $ex) {
                $skipped[] = "{$where}: " . collect($ex->errors())->flatten()->first();
                continue;
            }

            TimetableEntry::create($cell + [
                'course_id'    => $e->course_id,
                'teacher_name' => $e->teacher_name,
                'room'         => $e->room,
            ]);
            $copied++;
        }

        return response()->json([
            'message' => $source->isEmpty()
                ? "{$from->name} has no classes for this program, semester and shift."
                : "Copied {$copied} class(es) from {$from->name}." . ($skipped ? ' ' . count($skipped) . ' skipped.' : ''),
            'copied'  => $copied,
            'skipped' => $skipped,
        ]);
    }

    // GET /api/timetable/my — the logged-in student's timetable for the current term:
    // one grid per approved application (program + semester + shift).
    public function my(Request $request)
    {
        $term = AcademicTerm::current();

        $applications = Application::with('program:id,name,code')
            ->where('student_id', $request->user()->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->get();

        $days = collect($this->workingDays())->map(fn ($d) => ['key' => $d, 'label' => config("timetable.days.$d")])->values();
        $shiftCount = count($this->enabledShifts());

        $classes = $applications->map(function ($app) use ($term, $shiftCount) {
            $shift = $app->shift ?: 'morning';

            return [
                'application_id' => $app->id,
                'program'        => $app->program?->only(['id', 'name', 'code']),
                'semester_no'    => $app->semester_no,
                'shift'          => $shift,
                'shift_label'    => $shiftCount > 1 ? app(TimetableService::class)->shiftLabel($shift) : null,
                'periods'        => $this->periodsFor($shift),
                'entries'        => $term
                    ? TimetableEntry::with('course:id,code,title,credit_hours')
                        ->where('academic_term_id', $term->id)
                        ->where('program_id', $app->program_id)
                        ->where('semester_no', $app->semester_no)
                        ->where('shift', $shift)
                        ->get(['id', 'day', 'timetable_period_id', 'course_id', 'teacher_name', 'room'])
                    : [],
            ];
        })->values();

        return response()->json([
            'term'    => $term?->only(['id', 'name', 'start_date', 'end_date']),
            'days'    => $days,
            'classes' => $classes,
        ]);
    }

    // DELETE /api/timetable/{entry}
    public function destroy(TimetableEntry $entry)
    {
        $entry->delete();

        return response()->json(['message' => 'Class removed.']);
    }

    // ── helpers ───────────────────────────────────────────────────

    // Within one term, a teacher or room can't be in two classes whose times overlap on the
    // same day, in ANY program or shift (morning and evening periods are compared by clock time).
    private function checkClashes(array $data, TimetablePeriod $period): void
    {
        if (!$data['teacher_name'] && !$data['room']) {
            return;
        }

        $overlappingPeriodIds = TimetablePeriod::where('start_time', '<', $period->end_time)
            ->where('end_time', '>', $period->start_time)
            ->pluck('id');

        $others = TimetableEntry::with(['program:id,name,code', 'course:id,code,title', 'period'])
            ->where('academic_term_id', $data['academic_term_id'])
            ->where('day', $data['day'])
            ->whereIn('timetable_period_id', $overlappingPeriodIds)
            // not the cell being saved
            ->where(function ($q) use ($data, $period) {
                $q->where('program_id', '!=', $data['program_id'])
                  ->orWhere('semester_no', '!=', $data['semester_no'])
                  ->orWhere('shift', '!=', $data['shift'])
                  ->orWhere('timetable_period_id', '!=', $period->id);
            })
            ->get();

        $errors = [];
        foreach (['teacher_name' => 'teacher', 'room' => 'room'] as $field => $label) {
            if (!$data[$field]) continue;
            $hit = $others->first(fn ($e) => $e->$field && mb_strtolower($e->$field) === mb_strtolower($data[$field]));
            if ($hit) {
                $errors[$field] = ucfirst($label) . " \"{$data[$field]}\" is already booked then: " . $this->describe($hit) . '.';
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    // "BSCS Semester 1 (Morning), CS-101, Monday 08:30–09:30"
    private function describe(TimetableEntry $e): string
    {
        $program = $e->program->code ?: $e->program->name;
        $shift   = config("timetable.shifts.{$e->shift}", $e->shift);
        $day     = config("timetable.days.{$e->day}", $e->day);
        $time    = substr($e->period->start_time, 0, 5) . '–' . substr($e->period->end_time, 0, 5);

        return "{$program} Semester {$e->semester_no} ({$shift}), {$e->course->code}, {$day} {$time}";
    }

    private function periodsFor(string $shift)
    {
        return TimetablePeriod::where('shift', $shift)
            ->orderBy('start_time')
            ->get()
            ->map(fn ($p) => [
                'id'         => $p->id,
                'name'       => $p->name,
                'start_time' => substr($p->start_time, 0, 5),
                'end_time'   => substr($p->end_time, 0, 5),
                'is_break'   => $p->is_break,
            ]);
    }

    private function enabledShifts(): array
    {
        return app(TimetableService::class)->enabledShifts();
    }

    private function workingDays(): array
    {
        return app(TimetableService::class)->workingDays();
    }

    private function clean(?string $value): ?string
    {
        $value = trim(preg_replace('/\s+/', ' ', (string) $value));

        return $value === '' ? null : $value;
    }
}
