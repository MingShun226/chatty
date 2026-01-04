# Test if the WhatsApp webhook is working
# This simulates what Meta sends when a message is received

$webhookUrl = "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-webhook"

# Simulate a WhatsApp message webhook payload
$testPayload = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            id = "253998650230182276"
            changes = @(
                @{
                    value = @{
                        messaging_product = "whatsapp"
                        metadata = @{
                            display_phone_number = "+60 16 533 4085"
                            phone_number_id = "942571258938900"
                        }
                        messages = @(
                            @{
                                from = "60123456789"  # Replace with your actual phone number
                                id = "wamid.test123"
                                timestamp = "1234567890"
                                type = "text"
                                text = @{
                                    body = "Test message from PowerShell script"
                                }
                            }
                        )
                    }
                    field = "messages"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Sending test webhook payload..."
Write-Host "URL: $webhookUrl"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Headers @{
        "Content-Type" = "application/json"
    } -Body $testPayload

    Write-Host "✅ Webhook responded successfully!"
    Write-Host $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error calling webhook:"
    Write-Host $_.Exception.Message
}
