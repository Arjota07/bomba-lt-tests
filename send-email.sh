#!/usr/bin/env bash
# Email notification helper — uses Apple Mail.app via AppleScript
#
# Usage:
#   ./send-email.sh "recipient@example.com" "Subject" "Body text"
#   ./send-email.sh "to@x.com" "Subj" "$(cat body.txt)"

set -u

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <to> <subject> <body>" >&2
  exit 2
fi

TO="$1"
SUBJECT="$2"
BODY="$3"

# Escape double-quotes for AppleScript string literals
escape_as() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

TO_ESC=$(escape_as "$TO")
SUBJECT_ESC=$(escape_as "$SUBJECT")
BODY_ESC=$(escape_as "$BODY")

osascript <<EOF
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${SUBJECT_ESC}", content:"${BODY_ESC}" & return, visible:false}
  tell newMessage
    make new to recipient with properties {address:"${TO_ESC}"}
  end tell
  send newMessage
end tell
EOF

# osascript exit code propagates
exit $?
