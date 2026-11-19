<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;

class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request)
    {
        $request->validate([
            'cnic_no' => 'required|string|size:13',
        ]);

        $user = User::where('cnic_no', $request->cnic_no)->first();

        if (!$user || !$user->email) {
            // Always return same message to prevent user/email enumeration
            return response()->json(['message' => 'If an account with that CNIC exists, a reset link has been sent.']);
        }

        // Delete any existing tokens for this CNIC
        DB::table('password_reset_tokens')->where('cnic_no', $request->cnic_no)->delete();

        // Generate token
        $token = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'cnic_no' => $request->cnic_no,
            'token' => Hash::make($token),
            'created_at' => Carbon::now(),
        ]);

        // Build reset URL
        $frontendUrl = config('app.frontend_url');
        $resetUrl = $frontendUrl . '/reset-password?token=' . $token . '&cnic=' . $request->cnic_no;

        // Send email
        Mail::send([], [], function ($message) use ($user, $resetUrl) {
            $message->to($user->email)
                ->subject('Reset Your Password')
                ->html(
                    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">'
                    . '<div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">'
                    . '<h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>'
                    . '</div>'
                    . '<div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">'
                    . '<p style="color: #374151; font-size: 16px;">Hello ' . e($user->name) . ',</p>'
                    . '<p style="color: #6b7280; font-size: 14px;">You requested to reset your password. Click the button below to set a new password:</p>'
                    . '<div style="text-align: center; margin: 30px 0;">'
                    . '<a href="' . $resetUrl . '" style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Reset Password</a>'
                    . '</div>'
                    . '<p style="color: #9ca3af; font-size: 12px;">This link will expire in 60 minutes. If you did not request a password reset, please ignore this email.</p>'
                    . '</div>'
                    . '</div>'
                );
        });

        return response()->json(['message' => 'A password reset link has been sent to your registered email.']);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'cnic_no' => 'required|string|size:13',
            'token' => 'required|string',
            'password' => ['required', 'string', 'min:8', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('cnic_no', $request->cnic_no)
            ->first();

        if (!$record) {
            return response()->json(['message' => 'Invalid or expired reset token.'], 422);
        }

        // Check if token is expired (60 minutes)
        if (Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('cnic_no', $request->cnic_no)->delete();
            return response()->json(['message' => 'Reset token has expired. Please request a new one.'], 422);
        }

        if (!Hash::check($request->token, $record->token)) {
            return response()->json(['message' => 'Invalid or expired reset token.'], 422);
        }

        // Update password
        $user = User::where('cnic_no', $request->cnic_no)->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $user->update(['password' => $request->password]);
        
        // Nobody is logged in here, so name the user explicitly.
        \App\Models\AuditLog::record('auth.password_reset', $user, [], [], $user->id, $user->college_id);

        // Delete the used token
        DB::table('password_reset_tokens')->where('cnic_no', $request->cnic_no)->delete();

        return response()->json(['message' => 'Password has been reset successfully.']);
    }
}
