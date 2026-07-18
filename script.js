// 버튼과 타이틀 요소를 가져옵니다.
const button = document.getElementById('click-btn');
const title = document.getElementById('main-title');

// 버튼 클릭 이벤트 리스너 추가
button.addEventListener('click', () => {
    // 타이틀 텍스트와 색상을 변경합니다.
    title.textContent = "반갑습니다! 🚀";
    title.style.color = "#28a745";
    
    // 알림창 띄우기
    alert("JavaScript가 정상적으로 동작합니다!");
});