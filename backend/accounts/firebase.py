import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

if not firebase_admin._apps:
    cred = credentials.Certificate(str(settings.FIREBASE_CREDENTIALS_PATH))
    firebase_admin.initialize_app(cred)


def send_push_notification(token, title, body, data=None):
    if not token:
        return
    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token,
        )
        response = messaging.send(message)
        return response
    except Exception as e:
        print(f"Push notification failed: {e}")
        return None