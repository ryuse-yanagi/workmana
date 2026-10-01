<?php

namespace App\Mail;

use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrganizationInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public OrganizationInvite $invite,
        public Organization $organization,
        public string $plainToken,
        public string $inviteUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->organization->name} への招待",
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'emails.organization-invite',
            with: [
                'organizationName' => $this->organization->name,
                'inviteUrl' => $this->inviteUrl,
                'expiresAt' => $this->invite->expires_at,
                'role' => $this->invite->role,
            ],
        );
    }
}
