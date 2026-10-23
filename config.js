// ===== 基本設定 =====
// 1. firebase：填入 Firebase 專案設定後即為「雲端模式」，兩邊 OBS 會同步。
//    留 null 則為「本機模式」，只在同一個瀏覽器的分頁之間同步（測試用）。
// 2. room：房間代號，請改成別人猜不到的字串（等同密碼）。
//    也可以在網址後面加 ?room=xxxx 覆蓋。

window.APP_CONFIG = {
  room: 'change-me-to-a-random-string',
  firebaseConfig = {
  	apiKey: "AIzaSyB0lv1zSkH-n7oNFqG6tdHmsfyENuoi6bQ",
  	authDomain: "collab-overlay.firebaseapp.com",
  	databaseURL: "https://collab-overlay-default-rtdb.asia-southeast1.firebasedatabase.app",
  	projectId: "collab-overlay",
  	storageBucket: "collab-overlay.firebasestorage.app",
  	messagingSenderId: "543804268381",
  	appId: "1:543804268381:web:f57e5bb1c1f25dcd0bd2b4"
	};
};
