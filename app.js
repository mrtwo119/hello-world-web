/**
 * 개인 디지털 아카이브 - SQLite 로컬 파일 제어 로직
 */

let db = null;
let SQL = null;

// 1. 페이지 로드 시 SQL.js 웹어셈블리(WASM) 엔진 초기화
async function initSqlEngine() {
    try {
        const config = {
            // CDN을 통해 가상 SQLite 환경에 필요한 내부 WebAssembly 파일 로드
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        SQL = await initSqlJs(config);
    } catch (error) {
        console.error("SQL 엔진 초기화 실패:", error);
    }
}

// 2. 스마트폰 파일 탐색기로부터 DB 파일을 읽어와 메모리에 주입하는 루틴
document.getElementById('dbFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    // 파일을 바이너리 버퍼 형태로 완전히 읽었을 때 실행될 콜백
    reader.onload = function() {
        try {
            const uints = new Uint8Array(reader.result);
            
            // 바이너리 바이트 배열을 파싱하여 실시간 조회 가능한 DB 객체 생성
            db = new SQL.Database(uints);

            // UI 상태 변경 (연결 성공 표시 및 검색창 활성화)
            updateUIConnected();

            // 최초 로드 시 전체 도서 데이터 출력
            searchBooks('');
        } catch (error) {
            alert("올바른 SQLite DB 파일 형식이 아닙니다.\n에러 내용: " + error.message);
        }
    };
    
    // 바이너리 데이터 스트림 형태로 파일 읽기 시작
    reader.readAsArrayBuffer(file);
});

// 3. UI 연결 상태 업데이트 유틸리티 함수
function updateUIConnected() {
    const statusBadge = document.getElementById('dbStatus');
    statusBadge.innerText = "DB 연결됨";
    statusBadge.className = "text-xs bg-emerald-500 px-2 py-1 rounded-sm text-white font-medium";
    
    const searchInput = document.getElementById('searchInput');
    searchInput.disabled = false;
    searchInput.backgroundColor = "bg-white";
    searchInput.placeholder = "제목, 저자, ISBN 또는 키워드 검색...";
    searchInput.focus();
}

// 4. SQLite 질의 및 모바일 카드 레이아웃 렌더링 루틴
function searchBooks(keyword) {
    if (!db) return;
    
    const bookListDiv = document.getElementById('bookList');
    bookListDiv.innerHTML = '';

    // 대시보드 이미지에 있던 데이터 컬럼 기준 LIKE 패턴 매칭 쿼리 작성
    const query = `
        SELECT * FROM books 
        WHERE title LIKE ? OR kdc LIKE ? OR author LIKE ? OR publisher LIKE ?
        ORDER BY id ASC
    `;
    
    try {
        const stmt = db.prepare(query);
        // SQL Injection 방지를 위한 파라미터 바인딩 처리
        const searchPattern = `%${keyword}%`;
        stmt.bind([searchPattern, searchPattern, searchPattern, searchPattern]);

        let count = 0;

        // 결과 레코드를 순회하며 컴포넌트 동적 동적 생성
        while (stmt.step()) {
            count++;
            const row = stmt.getAsObject();
            
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-2.5";
            
            // 이미지 대시보드 스타일의 메타데이터 매핑
            card.innerHTML = `
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-400 font-mono">ID: ${row.id}</span>
                    <span class="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-sm">${row.kdc || '미분류'}</span>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-gray-900 leading-snug">${row.title}</h3>
                    <p class="text-xs text-gray-500 mt-1">${row.author || '저자 미상'} (${row.publisher || '출판사 미상'})</p>
                    <p class="text-[11px] text-gray-400">등록일자: ${row.reg_date || '-'}</p>
                </div>
                <hr class="border-gray-100">
                <div class="flex flex-col gap-1.5 text-xs text-gray-600">
                    <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-gray-400 text-[11px] mr-1">스토리지:</span>
                        <span class="${row.storage_ipad ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">iPad</span>
                        <span class="${row.storage_external ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">외장HDD</span>
                        <span class="${row.storage_gdrive ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">구글드라이브</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            🟢 ${row.status || '해결 완료'}
                        </span>
                        <div class="flex gap-1">
                            <button class="px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-md text-[11px] active:bg-gray-200">머지</button>
                            <button class="px-2.5 py-1 bg-red-50 text-red-500 font-medium rounded-md text-[11px] active:bg-red-100">삭제</button>
                        </div>
                    </div>
                </div>
            `;
            bookListDiv.appendChild(card);
        }
        
        stmt.free(); // 메모리 누수 방지를 위한 명령문 객체 해제
        document.getElementById('resultCount').innerText = count;
        
        if (count === 0) {
            bookListDiv.innerHTML = `<div class="text-center py-12 text-gray-400 text-sm">일치하는 아카이브 파일이 없습니다.</div>`;
        }
    } catch (err) {
        console.error(err);
        bookListDiv.innerHTML = `<div class="text-center py-12 text-red-500 text-sm">⚠️ 쿼리 에러: DB 내에 'books' 테이블 구조가 존재하는지 확인하세요.</div>`;
    }
}

// 5. 실시간 입력을 감지하는 검색 헨들러 등록
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchBooks(e.target.value.trim());
});

// 프로그램 시작 스크립트 실행
initSqlEngine();