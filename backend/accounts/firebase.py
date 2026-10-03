import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings
from pathlib import Path


# Firebase is optional.
# If the credentials file exists, Firebase will be initialized.
# If it does not exist, the application can still run normally.
firebase_enabled = False

if not firebase_admin._apps:
    credentials_path = Path(settings.FIREBASE_CREDENTIALS_PATH)

    if credentials_path.exists():
        try:
            cred = credentials.Certificate(str(credentials_path))
            firebase_admin.initialize_app(cred)
            firebase_enabled = True
            print("Firebase initialized successfully.")
        except Exception as e:
            print(f"Firebase initialization failed: {e}")
    else:
        print("Firebase credentials file not found. Push notifications are disabled.")


def send_push_notification(token, title, body, data=None):
    if not token or not firebase_enabled:
        return None

    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            token=token,
        )

        response = messaging.send(message)
        return response

    except Exception as e:
        print(f"Push notification failed: {e}")
        return None