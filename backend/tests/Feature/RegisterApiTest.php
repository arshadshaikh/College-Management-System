<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
App\Models\User; // Adjust if your model is different

class RegisterApiTest extends TestCase
{
    use RefreshDatabase; // Resets database for each test

    /** @test */
    public function it_successfully_registers_a_new_user()
    {
        // Arrange - Test data
        $userData = [
            'name' => 'Ali Hassan',
            'cnic_no' => '4210112345671',
            'email' => 'ali@example.com',
            'password' => 'Test1234',
            'password_confirmation' => 'Test1234',
            'father_name' => 'Hasan Ali',
            'gender' => 'male',
            'date_of_birth' => '2002-05-15'
        ];

        // Act - Make API request
        $response = $this->postJson('/api/register', $userData);

        // Assert - Check response & database
        $response
            ->assertStatus(201) // or 200, depending on your API
            ->assertJsonStructure([
                'success', 
                'message', 
                'data' => ['id', 'name', 'email', 'cnic_no']
            ]);

        // Verify user was created in database
        $this->assertDatabaseHas('users', [
            'email' => 'ali@example.com',
            'cnic_no' => '4210112345671'
        ]);

        // Verify password was hashed
        $user = User::where('email', 'ali@example.com')->first();
        $this->assertTrue($user->password !== 'Test1234');
    }

    /** @test */
    public function it_fails_validation_for_required_fields()
    {
        $response = $this->postJson('/api/register', []);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => []
            ]);
    }

    /** @test */
    public function it_fails_with_duplicate_email()
    {
        // Create existing user
        User::factory()->create([
            'email' => 'test@example.com'
        ]);

        $response = $this->postJson('/api/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            // ... other fields
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function it_fails_with_password_mismatch()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'Test1234',
            'password_confirmation' => 'Different1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }
    
    /**
     * A basic feature test example.
     */
    public function test_example(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }
}
