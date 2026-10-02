function userProfileEscape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char])
  );
}

function userProfileAvatar(user) {
  const username =
    String(user?.username || 'U');

  if (user?.avatarUrl) {
    return `
      <img
        src="${userProfileEscape(
          user.avatarUrl
        )}"
        alt="รูปโปรไฟล์"
        style="
          width:86px;
          height:86px;
          object-fit:cover;
          border-radius:50%;
        "
      >
    `;
  }

  return `
    <div
      class="avatar"
      style="
        width:86px;
        height:86px;
        font-size:36px;
        background:var(--accent);
      "
    >
      ${userProfileEscape(
        username.charAt(0).toUpperCase()
      )}
    </div>
  `;
}

function renderUserProfileLoading() {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  target.innerHTML = `
    <div
      style="
        padding:28px;
        text-align:center;
        color:var(--muted);
      "
    >
      กำลังโหลดโปรไฟล์...
    </div>
  `;
}