<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Collection;

class StudentsImport implements ToCollection, WithHeadingRow
{
    public Collection $rows;

    public function collection(Collection $rows)
    {
        // Just capture the rows; validation + creation happens in the controller
        // so we can build a partial-success report.
        $this->rows = $rows;
    }
}