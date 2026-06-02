<?php

namespace App\Console\Commands;

use App\Models\Challan;
use Illuminate\Console\Command;

class MarkOverdueChallans extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    // protected $signature = 'app:mark-overdue-challans';
    protected $signature = 'challans:mark-overdue';

    /**
     * The console command description.
     *
     * @var string
     */
    // protected $description = 'Command description';
    protected $description = 'Mark unpaid challans past their due date as overdue';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $count = Challan::withoutGlobalScope('tenant')
            ->where('status', 'unpaid')
            ->where('due_date', '<', today())
            ->update(['status' => 'overdue']);

        $this->info("Marked {$count} challan(s) as overdue.");
    }
}
