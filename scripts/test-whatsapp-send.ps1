# Test sending a WhatsApp message using the Meta API
$accessToken = "EAASdenND2VkBQeu3MComijoz8rWtCHoEzYrp2zC7MZBOnfTM4uzMZA0IFCCMyxcumMJwyot2BrR7KH33X0oCsmZB87EbOFHcx2C6qUReGt7wpBnxyMZBWLPM2ZCb2SwIEyiZAZApjr8BVKgnMLNAYU6KqoOFzYTGATIJbJbGdWgfUTlhYIq5t0Oxo8xFLGgqmIaXfPHbR514S6JNKD1RuRzSsZAD7W2yiSQtC1JrFp4Es7u0YgDbuM9tZAAWkGB7TOsDJiYHULxi5AHL5yKsbgXJgMrPRMgZDZD"
$phoneNumberId = "942571258938900"
$toPhoneNumber = "YOUR_PHONE_NUMBER_HERE" # Replace with your actual WhatsApp number (e.g., 60123456789)

$url = "https://graph.facebook.com/v21.0/$phoneNumberId/messages"

$body = @{
    messaging_product = "whatsapp"
    to = $toPhoneNumber
    type = "text"
    text = @{
        body = "Hello! This is a test message from Wendy chatbot. Reply to test the auto-response!"
    }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "Message sent successfully!"
Write-Host $response | ConvertTo-Json
