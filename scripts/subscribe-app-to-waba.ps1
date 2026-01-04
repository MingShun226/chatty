# Subscribe your Meta app to the WhatsApp Business Account
# This allows the app to receive webhooks from this WABA

$accessToken = "EAASdenND2VkBQeu3MComijoz8rWtCHoEzYrp2zC7MZBOnfTM4uzMZA0IFCCMyxcumMJwyot2BrR7KH33X0oCsmZB87EbOFHcx2C6qUReGt7wpBnxyMZBWLPM2ZCb2SwIEyiZAZApjr8BVKgnMLNAYU6KqoOFzYTGATIJbJbGdWgfUTlhYIq5t0Oxo8xFLGgqmIaXfPHbR514S6JNKD1RuRzSsZAD7W2yiSQtC1JrFp4Es7u0YgDbuM9tZAAWkGB7TOsDJiYHULxi5AHL5yKsbgXJgMrPRMgZDZD"
$wabaId = "253998650230182276"

$url = "https://graph.facebook.com/v21.0/$wabaId/subscribed_apps"

Write-Host "Subscribing app to WABA..."
Write-Host "WABA ID: $wabaId"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
        "Authorization" = "Bearer $accessToken"
    }

    Write-Host "✅ App subscribed successfully!"
    Write-Host $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error:"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}

# Also check current subscription status
Write-Host "`nChecking current subscriptions..."
try {
    $checkResponse = Invoke-RestMethod -Uri $url -Method Get -Headers @{
        "Authorization" = "Bearer $accessToken"
    }
    Write-Host "Current subscriptions:"
    Write-Host $checkResponse | ConvertTo-Json
} catch {
    Write-Host "Could not check subscriptions"
}
