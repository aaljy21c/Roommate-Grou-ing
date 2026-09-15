const API_URL = '/api';

let allStudents = [];
let allRooms = [];
let stats = {};

let currentMode = null; // 'create', 'edit', null
let selectedType = null; // 2 or 3
let selectedStudents = new Set();
let editRoomId = null;

// DOM Elements
const twoPersonCountEl = document.getElementById('two-person-count');
const threePersonCountEl = document.getElementById('three-person-count');
const btnType2 = document.getElementById('btn-type-2');
const btnType3 = document.getElementById('btn-type-3');
const selectionArea = document.getElementById('selection-area');
const requiredCountEl = document.getElementById('required-count');
const studentsGrid = document.getElementById('students-grid');
const roomBirthdate = document.getElementById('room-birthdate');
const roomPassword = document.getElementById('room-password');
const btnSubmit = document.getElementById('btn-submit');
const btnCancelCreation = document.getElementById('btn-cancel-creation');
const roomsGrid = document.getElementById('rooms-grid');

// Modal Elements
const modal = document.getElementById('password-modal');
const modalPassword = document.getElementById('modal-password');
const btnModalEdit = document.getElementById('btn-modal-edit');
const btnModalDelete = document.getElementById('btn-modal-delete');
const btnModalClose = document.getElementById('btn-modal-close');

let selectedRoomForAction = null; // Store room id when clicked on edit/delete

// Initialize
async function init() {
    await fetchStatus();
    setInterval(fetchStatus, 5000); // Poll every 5 seconds
}

async function fetchStatus() {
    try {
        const response = await fetch(`${API_URL}/status`);
        const data = await response.json();
        
        allStudents = data.students;
        allRooms = data.rooms;
        stats = data.stats;

        updateUI();
    } catch (error) {
        console.error("Failed to fetch status:", error);
    }
}

function updateUI() {
    // Update Stats
    twoPersonCountEl.textContent = stats.twoPersonRooms;
    threePersonCountEl.textContent = stats.threePersonRooms;

    const box2 = document.getElementById('two-person-stat');
    if (stats.twoPersonRooms >= stats.twoPersonMax) {
        box2.classList.add('full');
        btnType2.disabled = true;
        btnType2.textContent = '2인실 마감';
    } else {
        box2.classList.remove('full');
        btnType2.disabled = false;
        btnType2.textContent = '2인실 만들기';
    }

    const box3 = document.getElementById('three-person-stat');
    if (stats.threePersonRooms >= stats.threePersonMax) {
        box3.classList.add('full');
        btnType3.disabled = true;
        btnType3.textContent = '3인실 마감';
    } else {
        box3.classList.remove('full');
        btnType3.disabled = false;
        btnType3.textContent = '3인실 만들기';
    }

    // Update Students Grid if in creation mode or edit mode
    renderStudentsGrid();

    // Update Rooms Grid
    renderRoomsGrid();
}

function renderStudentsGrid() {
    if (!currentMode) return;
    
    studentsGrid.innerHTML = '';
    
    allStudents.forEach(student => {
        const div = document.createElement('div');
        div.className = 'student-card';
        div.textContent = `${student.name}`;
        
        // If student is assigned to ANOTHER room, disable them
        let isAssignedElsewhere = student.assigned;
        if (currentMode === 'edit' && editRoomId) {
            const currentRoom = allRooms.find(r => r.id === editRoomId);
            if (currentRoom && currentRoom.members.includes(student.id)) {
                isAssignedElsewhere = false;
            }
        }

        if (isAssignedElsewhere) {
            div.classList.add('disabled');
            div.title = '이미 배정됨';
        } else {
            if (selectedStudents.has(student.id)) {
                div.classList.add('selected');
            }
            div.addEventListener('click', () => toggleStudentSelection(student.id, div));
        }
        
        studentsGrid.appendChild(div);
    });
}

function toggleStudentSelection(studentId, element) {
    if (selectedStudents.has(studentId)) {
        selectedStudents.delete(studentId);
        element.classList.remove('selected');
    } else {
        if (selectedStudents.size < selectedType) {
            selectedStudents.add(studentId);
            element.classList.add('selected');
        } else {
            alert(`최대 ${selectedType}명까지만 선택할 수 있습니다.`);
        }
    }
}

function renderRoomsGrid() {
    roomsGrid.innerHTML = '';
    
    allRooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-card';
        
        const typeBadge = document.createElement('div');
        typeBadge.className = 'room-type-badge';
        typeBadge.textContent = `${room.type}인실`;
        
        const membersDiv = document.createElement('div');
        membersDiv.className = 'room-members';
        
        room.members.forEach(memberId => {
            const student = allStudents.find(s => s.id === memberId);
            if (student) {
                const badge = document.createElement('span');
                badge.className = 'member-badge';
                badge.textContent = student.name;
                membersDiv.appendChild(badge);
            }
        });
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'room-time';
        timeDiv.textContent = `업데이트: ${new Date(room.updated_at).toLocaleString()}`;
        
        const actionBtn = document.createElement('button');
        actionBtn.className = 'btn btn-secondary';
        actionBtn.style.padding = '0.5rem 1rem';
        actionBtn.style.fontSize = '0.875rem';
        actionBtn.textContent = '수정/취소';
        actionBtn.addEventListener('click', () => openModal(room.id));
        
        div.appendChild(typeBadge);
        div.appendChild(membersDiv);
        div.appendChild(timeDiv);
        div.appendChild(actionBtn);
        
        roomsGrid.appendChild(div);
    });
}

// Event Listeners
btnType2.addEventListener('click', () => startCreation(2));
btnType3.addEventListener('click', () => startCreation(3));
btnCancelCreation.addEventListener('click', cancelCreation);

function startCreation(type) {
    currentMode = 'create';
    selectedType = type;
    selectedStudents.clear();
    roomBirthdate.value = '';
    roomPassword.value = '';
    
    btnType2.classList.remove('active');
    btnType3.classList.remove('active');
    if (type === 2) btnType2.classList.add('active');
    if (type === 3) btnType3.classList.add('active');
    
    selectionArea.classList.remove('hidden');
    requiredCountEl.textContent = type;
    document.getElementById('selection-title').textContent = '인원 선택 (새 방)';
    
    renderStudentsGrid();
    selectionArea.scrollIntoView({ behavior: 'smooth' });
}

function cancelCreation() {
    currentMode = null;
    selectedType = null;
    selectedStudents.clear();
    editRoomId = null;
    
    btnType2.classList.remove('active');
    btnType3.classList.remove('active');
    selectionArea.classList.add('hidden');
}

btnSubmit.addEventListener('click', async () => {
    if (selectedStudents.size !== selectedType) {
        return alert(`${selectedType}명을 정확히 선택해주세요. (본인 포함)`);
    }
    
    const pwd = roomPassword.value.trim();
    const bd = roomBirthdate.value.trim();
    
    if (pwd !== 'a1357') {
        if (!/^[0-9]{5}$/.test(pwd)) {
            return alert('비밀번호는 숫자 5자리여야 합니다.');
        }
        if (!/^[0-9]{4}$/.test(bd)) {
            return alert('생년월일은 숫자 4자리여야 합니다.');
        }
    }
    
    const members = Array.from(selectedStudents);
    
    try {
        let res;
        if (currentMode === 'create') {
            res = await fetch(`${API_URL}/room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: selectedType, password: pwd, birthdate: bd, members })
            });
        } else if (currentMode === 'edit') {
            res = await fetch(`${API_URL}/room/${editRoomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd, birthdate: bd, members })
            });
        }
        
        const data = await res.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(currentMode === 'create' ? '방이 생성되었습니다.' : '방이 수정되었습니다.');
            cancelCreation();
            fetchStatus();
        }
    } catch (e) {
        console.error(e);
        alert('요청 중 오류가 발생했습니다.');
    }
});

// Modal Logic
function openModal(roomId) {
    selectedRoomForAction = roomId;
    modalPassword.value = '';
    modal.classList.remove('hidden');
}

btnModalClose.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedRoomForAction = null;
});

btnModalEdit.addEventListener('click', async () => {
    const pwd = modalPassword.value.trim();
    if (!pwd) return alert('비밀번호를 입력하세요.');
    
    if (!confirm('정말로 이 방 배정을 수정하시겠습니까?')) return;
    
    try {
        const res = await fetch(`${API_URL}/room/${selectedRoomForAction}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        
        const data = await res.json();
        if (data.error) {
            return alert(data.error);
        }
        
        // Success - move to edit mode
        const room = allRooms.find(r => r.id === selectedRoomForAction);
        if (!room) return;
        
        currentMode = 'edit';
        selectedType = room.type;
        editRoomId = room.id;
        selectedStudents = new Set(room.members);
        
        // 처음처럼 세팅할 수 있도록 초기화
        roomPassword.value = ''; 
        roomBirthdate.value = ''; 
        
        btnType2.classList.remove('active');
        btnType3.classList.remove('active');
        selectionArea.classList.remove('hidden');
        requiredCountEl.textContent = selectedType;
        document.getElementById('selection-title').textContent = '인원 선택 (방 수정)';
        
        renderStudentsGrid();
        selectionArea.scrollIntoView({ behavior: 'smooth' });
        
        modal.classList.add('hidden');
    } catch (e) {
        console.error(e);
        alert('비밀번호 확인 중 오류가 발생했습니다.');
    }
});

btnModalDelete.addEventListener('click', async () => {
    const pwd = modalPassword.value.trim();
    if (!pwd) return alert('비밀번호를 입력하세요.');
    
    if (!confirm('정말로 이 방 배정을 취소하시겠습니까?')) return;
    
    try {
        const res = await fetch(`${API_URL}/room/${selectedRoomForAction}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        
        const data = await res.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert('방 배정이 취소되었습니다.');
            modal.classList.add('hidden');
            if (currentMode === 'edit' && editRoomId === selectedRoomForAction) {
                cancelCreation();
            }
            fetchStatus();
        }
    } catch (e) {
        console.error(e);
        alert('오류가 발생했습니다.');
    }
});

const btnResetAll = document.getElementById('btn-reset-all');
if (btnResetAll) {
    btnResetAll.addEventListener('click', async () => {
        const pwd = prompt('마스터키를 입력하세요 (선생님 전용):');
        if (pwd === null) return; // cancelled
        if (!pwd) return alert('마스터키를 입력해야 합니다.');

        if (!confirm('정말로 모든 방 배정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        try {
            const res = await fetch(`${API_URL}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });

            const data = await res.json();
            if (data.error) {
                alert(data.error);
            } else {
                alert('모든 방 배정이 성공적으로 초기화되었습니다.');
                cancelCreation();
                fetchStatus();
            }
        } catch (e) {
            console.error(e);
            alert('초기화 중 오류가 발생했습니다.');
        }
    });
}

init();
