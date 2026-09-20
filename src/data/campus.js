// Campus metadata. Buildings are linked to the existing map objects by `mapObjectId`
// (the OSM element id the map already assigns to each grouped building) with `mapName`
// as a fallback, so nothing here duplicates map geometry.
//
// Prototype data: descriptions, hours, clubs and events are written for the demo and
// should be verified against Virginia Tech's official sources before real use.

export const PLACES = [
  {
    id: "burruss", mapObjectId: "relation/1074686", mapName: "Burruss Hall", category: "Academic & admin",
    departments: ["Office of the President", "Registrar", "Burruss Hall Auditorium"],
    accessibility: { stepFree: true, elevator: true, entrance: "e" },
    text: {
      en: { description: "The limestone landmark at the head of the Drillfield and the symbol of Virginia Tech.", purpose: "Central administration and the university's largest auditorium.", why: "Convocation, big lectures and the registrar's office." },
      es: { description: "El edificio de piedra caliza al frente del Drillfield y el símbolo de Virginia Tech.", purpose: "Administración central y el auditorio más grande de la universidad.", why: "Ceremonias, grandes conferencias y la oficina del registro." },
      zh: { description: "矗立在 Drillfield 尽头的石灰岩地标，也是弗吉尼亚理工的象征。", purpose: "学校行政中心，设有全校最大的礼堂。", why: "开学典礼、大型讲座和注册办公室都在这里。" },
      hi: { description: "Drillfield के सिरे पर खड़ी चूना-पत्थर की यह इमारत वर्जीनिया टेक की पहचान है।", purpose: "केंद्रीय प्रशासन और विश्वविद्यालय का सबसे बड़ा ऑडिटोरियम।", why: "दीक्षांत समारोह, बड़े व्याख्यान और रजिस्ट्रार कार्यालय।" },
      ko: { description: "Drillfield 끝에 서 있는 석회암 건물로 버지니아 공대의 상징입니다.", purpose: "본부 행정과 대학에서 가장 큰 강당이 있습니다.", why: "입학식, 대형 강의, 학적 사무실이 이곳에 있습니다." },
    },
  },
  {
    id: "torgersen", mapObjectId: "relation/1074689", mapName: "Torgersen Hall", category: "Academic & admin",
    departments: ["Computer Science labs", "Advanced Communications", "Study rooms", "Torgersen Bridge"],
    accessibility: { stepFree: true, elevator: true, entrance: "n" },
    text: {
      en: { description: "Classrooms, computing labs and study space, joined to Newman Library by the glass Torgersen Bridge.", purpose: "Engineering and computer science teaching and study space.", why: "Late-night study rooms and the bridge walkway over Alumni Mall." },
      es: { description: "Aulas, laboratorios de computación y espacios de estudio, unidos a Newman Library por el puente de cristal Torgersen.", purpose: "Espacio de enseñanza y estudio de ingeniería e informática.", why: "Salas de estudio hasta tarde y el puente sobre Alumni Mall." },
      zh: { description: "教室、计算机实验室和自习空间，通过玻璃廊桥 Torgersen Bridge 与 Newman 图书馆相连。", purpose: "工程与计算机科学的教学和自习空间。", why: "可用到深夜的自习室，以及横跨 Alumni Mall 的廊桥。" },
      hi: { description: "कक्षाएँ, कंप्यूटर लैब और पढ़ने की जगह; काँच के Torgersen Bridge से Newman Library से जुड़ा हुआ।", purpose: "इंजीनियरिंग और कंप्यूटर साइंस की पढ़ाई का केंद्र।", why: "देर रात तक खुले स्टडी रूम और Alumni Mall के ऊपर का पुल।" },
      ko: { description: "강의실과 전산 실습실, 학습 공간이 있으며 유리 다리 Torgersen Bridge로 Newman 도서관과 이어집니다.", purpose: "공학·컴퓨터과학 강의와 학습 공간입니다.", why: "늦게까지 쓰는 스터디룸과 Alumni Mall 위를 지나는 다리." },
    },
  },
  {
    id: "torgersen-bridge", mapName: "Torgersen Hall", kind: "landmark", category: "Landmarks", nearName: "Newman Library",
    departments: [], accessibility: { stepFree: true, elevator: true, entrance: "n" },
    text: {
      en: { description: "The glass-and-stone bridge linking Torgersen Hall to Newman Library above Alumni Mall.", purpose: "A warm indoor shortcut between the library and the engineering classrooms.", why: "The best indoor study seats on campus, and a dry crossing in the rain." },
      es: { description: "El puente de cristal y piedra que une Torgersen Hall con Newman Library sobre Alumni Mall.", purpose: "Un atajo interior entre la biblioteca y las aulas de ingeniería.", why: "Los mejores asientos de estudio bajo techo y un paso seco cuando llueve." },
      zh: { description: "横跨 Alumni Mall、连接 Torgersen Hall 与 Newman 图书馆的玻璃石桥。", purpose: "图书馆与工程教室之间温暖的室内捷径。", why: "校园里最棒的室内自习座位，下雨天也不会淋湿。" },
      hi: { description: "Alumni Mall के ऊपर Torgersen Hall को Newman Library से जोड़ने वाला काँच और पत्थर का पुल।", purpose: "पुस्तकालय और इंजीनियरिंग कक्षाओं के बीच गर्म, भीतर का रास्ता।", why: "कैंपस की सबसे अच्छी इनडोर स्टडी सीटें और बारिश में सूखा रास्ता।" },
      ko: { description: "Alumni Mall 위로 Torgersen Hall과 Newman 도서관을 잇는 유리·석조 다리입니다.", purpose: "도서관과 공학 강의실을 잇는 따뜻한 실내 지름길입니다.", why: "캠퍼스에서 가장 좋은 실내 학습 자리이자 비 오는 날 젖지 않는 통로." },
    },
  },
  {
    id: "newman", mapObjectId: "relation/548450", mapName: "Newman Library", category: "Libraries",
    departments: ["Research help desk", "Group study rooms", "Media lab", "Cafe"],
    accessibility: { stepFree: true, elevator: true, entrance: "w" },
    text: {
      en: { description: "The main university library, open late, with quiet floors upstairs and group rooms below.", purpose: "Study space, research help, laptops and course reserves.", why: "Quiet study, printing, and free help finding sources for your first papers." },
      es: { description: "La biblioteca principal, abierta hasta tarde, con pisos silenciosos arriba y salas de grupo abajo.", purpose: "Espacio de estudio, ayuda para investigar, portátiles y reservas de cursos.", why: "Estudio en silencio, impresión y ayuda gratuita para tus primeros trabajos." },
      zh: { description: "学校主图书馆，开放到很晚，楼上是安静楼层，楼下设有小组讨论室。", purpose: "自习空间、研究咨询、笔记本电脑借用和课程参考资料。", why: "安静自习、打印，以及写第一篇论文时的免费文献帮助。" },
      hi: { description: "मुख्य विश्वविद्यालय पुस्तकालय, देर तक खुला; ऊपर शांत मंज़िलें और नीचे समूह कक्ष।", purpose: "पढ़ने की जगह, शोध में मदद, लैपटॉप और कोर्स रिज़र्व।", why: "शांति से पढ़ाई, प्रिंटिंग और पहले असाइनमेंट के लिए मुफ़्त मदद।" },
      ko: { description: "늦게까지 여는 중앙 도서관으로, 위층은 조용한 열람실, 아래층은 그룹 스터디룸입니다.", purpose: "학습 공간, 연구 지원, 노트북 대여, 강의 지정 도서.", why: "조용한 공부, 인쇄, 첫 과제 자료 찾기 도움을 받을 수 있어요." },
    },
  },
  {
    id: "mcbryde", mapObjectId: "way/43082481", mapName: "McBryde Hall", category: "Academic & admin",
    departments: ["Computer Science", "Mathematics", "Large lecture halls"],
    accessibility: { stepFree: true, elevator: true, entrance: "n" },
    text: {
      en: { description: "Home of computer science and mathematics, with the big first-year lecture halls.", purpose: "Lectures, CS labs and faculty offices.", why: "Most first-year CS and calculus classes meet here." },
      es: { description: "Sede de informática y matemáticas, con las grandes aulas de primer año.", purpose: "Clases magistrales, laboratorios de informática y despachos.", why: "Aquí se dan casi todas las clases de CS y cálculo de primer año." },
      zh: { description: "计算机科学与数学系所在地，设有面向新生的大阶梯教室。", purpose: "大课讲授、计算机实验室和教师办公室。", why: "大多数一年级的 CS 和微积分课都在这里上。" },
      hi: { description: "कंप्यूटर साइंस और गणित का भवन, जहाँ पहले वर्ष के बड़े लेक्चर हॉल हैं।", purpose: "व्याख्यान, सीएस लैब और शिक्षकों के कार्यालय।", why: "पहले साल की ज़्यादातर CS और कैलकुलस कक्षाएँ यहीं होती हैं।" },
      ko: { description: "컴퓨터과학과 수학의 본거지로, 신입생 대형 강의실이 있습니다.", purpose: "강의, 전산 실습실, 교수 연구실.", why: "1학년 CS와 미적분 수업 대부분이 여기에서 열립니다." },
    },
  },
  {
    id: "squires", mapObjectId: "way/32937985", mapName: "Squires Student Center", category: "Academic & admin",
    departments: ["Student organizations", "Cultural and community centers", "Food court", "Theatre"],
    accessibility: { stepFree: true, elevator: true, entrance: "s" },
    text: {
      en: { description: "The student union: clubs, cultural centers, performance spaces and a food court.", purpose: "Student life, meetings, events and hanging out between classes.", why: "Club fairs, cultural centers and a place to meet people." },
      es: { description: "El centro estudiantil: clubes, centros culturales, espacios de actuación y un patio de comidas.", purpose: "Vida estudiantil, reuniones, eventos y descansos entre clases.", why: "Ferias de clubes, centros culturales y un lugar para conocer gente." },
      zh: { description: "学生活动中心：社团、文化中心、演出空间和美食广场。", purpose: "学生生活、会议、活动和课间休息的场所。", why: "社团招新、文化中心，也是结识朋友的好地方。" },
      hi: { description: "छात्र केंद्र: क्लब, सांस्कृतिक केंद्र, प्रदर्शन स्थल और फ़ूड कोर्ट।", purpose: "छात्र जीवन, बैठकें, कार्यक्रम और कक्षाओं के बीच का समय।", why: "क्लब मेले, सांस्कृतिक केंद्र और नए लोगों से मिलने की जगह।" },
      ko: { description: "학생회관으로 동아리, 문화 센터, 공연장, 푸드코트가 있습니다.", purpose: "학생 활동, 모임, 행사, 수업 사이 휴식 공간.", why: "동아리 박람회와 문화 센터가 있고 친구를 만나기 좋아요." },
    },
  },
  {
    id: "dietrick", mapObjectId: "way/26210236", mapName: "Dietrick Hall", category: "Dining",
    departments: ["D2 dining hall", "Deet's Place", "Dietrick Express"],
    accessibility: { stepFree: true, elevator: true, entrance: "e" },
    text: {
      en: { description: "An all-you-care-to-eat dining hall beside the Ambler Johnston residence halls, plus a coffee spot.", purpose: "Campus dining for residential students.", why: "The closest big dining hall to the upper-quad residence halls." },
      es: { description: "Un comedor de bufé libre junto a las residencias Ambler Johnston, con cafetería incluida.", purpose: "Comedor del campus para estudiantes residentes.", why: "El comedor grande más cercano a las residencias." },
      zh: { description: "位于 Ambler Johnston 宿舍旁的自助餐厅，另设咖啡吧。", purpose: "为住校学生提供的校园餐饮。", why: "距离宿舍区最近的大型餐厅。" },
      hi: { description: "Ambler Johnston छात्रावासों के पास का बुफ़े डाइनिंग हॉल, साथ में कॉफ़ी की जगह।", purpose: "छात्रावास में रहने वालों के लिए कैंपस भोजन।", why: "छात्रावासों के सबसे नज़दीक का बड़ा डाइनिंग हॉल।" },
      ko: { description: "Ambler Johnston 기숙사 옆의 뷔페식 식당이며 카페도 함께 있습니다.", purpose: "기숙사 학생을 위한 캠퍼스 식당입니다.", why: "기숙사에서 가장 가까운 대형 식당이에요." },
    },
  },
  {
    id: "pritchard", mapObjectId: "relation/308029", mapName: "Pritchard Hall", category: "Residence halls",
    departments: ["Residence hall", "Community kitchen", "Study lounges"],
    accessibility: { stepFree: true, elevator: true, entrance: "w" },
    text: {
      en: { description: "One of the largest residence halls, on the upper quad next to the dining halls and rec center.", purpose: "First-year and returning student housing.", why: "Home base: laundry, lounges and a five-minute walk to D2." },
      es: { description: "Una de las residencias más grandes, junto a los comedores y el centro recreativo.", purpose: "Alojamiento para estudiantes de primer año y veteranos.", why: "Tu base: lavandería, salas comunes y cinco minutos a pie hasta D2." },
      zh: { description: "校园里最大的宿舍楼之一，紧邻餐厅和健身中心。", purpose: "一年级和高年级学生宿舍。", why: "你的大本营：洗衣房、休息室，步行五分钟到 D2 餐厅。" },
      hi: { description: "सबसे बड़े छात्रावासों में से एक, डाइनिंग हॉल और रिक्रिएशन सेंटर के पास।", purpose: "पहले वर्ष और अन्य छात्रों के लिए आवास।", why: "आपका ठिकाना: लॉन्ड्री, लाउंज और D2 तक पाँच मिनट की दूरी।" },
      ko: { description: "식당과 레크리에이션 센터 옆에 있는 대형 기숙사 중 하나입니다.", purpose: "신입생과 재학생 기숙사입니다.", why: "세탁실과 라운지가 있고 D2 식당까지 도보 5분입니다." },
    },
  },
  {
    id: "lane-stadium", mapObjectId: "relation/2417911", mapName: "Lane Stadium", category: "Athletics & recreation",
    departments: ["Football stadium", "Student section"],
    accessibility: { stepFree: true, elevator: false, entrance: "n" },
    text: {
      en: { description: "The 65,000-seat home of Hokie football, famous for Enter Sandman before kickoff.", purpose: "Football games and big campus events.", why: "Students get tickets through a lottery — go early for the student section." },
      es: { description: "El estadio de 65.000 asientos del fútbol americano Hokie, famoso por Enter Sandman antes del saque.", purpose: "Partidos de fútbol y grandes eventos del campus.", why: "Los estudiantes consiguen entradas por sorteo: llega temprano a la zona estudiantil." },
      zh: { description: "可容纳 6.5 万人的 Hokie 橄榄球主场，开赛前的 Enter Sandman 全场跳跃很有名。", purpose: "橄榄球比赛和大型校园活动。", why: "学生票通过抽签发放——记得早点去学生看台。" },
      hi: { description: "65,000 दर्शकों वाला Hokie फ़ुटबॉल का घरेलू मैदान, किक-ऑफ़ से पहले Enter Sandman के लिए मशहूर।", purpose: "फ़ुटबॉल मैच और बड़े कैंपस कार्यक्रम।", why: "छात्रों को टिकट लॉटरी से मिलते हैं — स्टूडेंट सेक्शन के लिए जल्दी पहुँचें।" },
      ko: { description: "6만 5천 석 규모의 Hokie 풋볼 경기장으로, 경기 전 Enter Sandman으로 유명합니다.", purpose: "풋볼 경기와 대형 캠퍼스 행사.", why: "학생 티켓은 추첨제예요. 학생 구역은 일찍 가는 게 좋아요." },
    },
  },
  {
    id: "drillfield", mapName: "Drillfield", kind: "landmark", category: "Landmarks",
    departments: [], accessibility: { stepFree: true, elevator: false, entrance: "n" },
    text: {
      en: { description: "The huge oval lawn at the center of campus that every main building faces.", purpose: "The crossroads of campus — everyone walks across it between classes.", why: "Frisbee, Gobblerfest, and the fastest route between most classes." },
      es: { description: "El enorme césped ovalado en el centro del campus al que dan todos los edificios principales.", purpose: "El cruce del campus: todos lo atraviesan entre clases.", why: "Frisbee, Gobblerfest y la ruta más rápida entre clases." },
      zh: { description: "位于校园中心的大片椭圆草坪，主要建筑都面向它。", purpose: "校园的十字路口——大家上下课都从这里穿过。", why: "飞盘、Gobblerfest 迎新活动，也是往返教室最快的路线。" },
      hi: { description: "कैंपस के बीचों-बीच फैला विशाल अंडाकार मैदान, जिसकी ओर सभी मुख्य इमारतें मुड़ी हैं।", purpose: "कैंपस का चौराहा — सब कक्षाओं के बीच यहीं से गुज़रते हैं।", why: "फ़्रिसबी, Gobblerfest और कक्षाओं के बीच सबसे तेज़ रास्ता।" },
      ko: { description: "캠퍼스 중앙의 거대한 타원형 잔디밭으로 주요 건물이 모두 이곳을 향합니다.", purpose: "캠퍼스의 교차로로, 수업 사이에 모두가 가로질러 갑니다.", why: "프리스비, Gobblerfest 행사, 그리고 수업 간 최단 경로예요." },
    },
  },
  {
    id: "mccomas", mapObjectId: "relation/1165680", mapName: "McComas Hall", category: "Athletics & recreation",
    departments: ["Recreation center", "Cook Counseling Center", "Fitness classes"],
    accessibility: { stepFree: true, elevator: true, entrance: "n" },
    text: {
      en: { description: "The campus gym next to the upper-quad residence halls, with counseling services upstairs.", purpose: "Fitness, intramurals, pool and student counseling.", why: "Free with tuition — weights, classes and Cook Counseling." },
      es: { description: "El gimnasio del campus junto a las residencias, con servicios de consejería arriba.", purpose: "Gimnasio, deportes internos, piscina y consejería estudiantil.", why: "Incluido en la matrícula: pesas, clases y Cook Counseling." },
      zh: { description: "紧邻宿舍区的校园健身房，楼上设有心理咨询中心。", purpose: "健身、院系联赛、游泳池和学生心理咨询。", why: "学费已包含——器械、团课和 Cook 心理咨询中心。" },
      hi: { description: "छात्रावासों के पास का कैंपस जिम, ऊपर काउंसलिंग सेवाएँ।", purpose: "फ़िटनेस, इंट्राम्यूरल खेल, पूल और छात्र काउंसलिंग।", why: "ट्यूशन में शामिल — वेट्स, क्लासेस और Cook Counseling।" },
      ko: { description: "기숙사 옆 캠퍼스 체육관이며 위층에는 상담 센터가 있습니다.", purpose: "운동, 교내 리그, 수영장, 학생 상담.", why: "등록금에 포함되어 있고 웨이트, 수업, 상담을 이용할 수 있어요." },
    },
  },
  {
    id: "goodwin", mapObjectId: "way/357515790", mapName: "Goodwin Hall", category: "Academic & admin",
    departments: ["Engineering Education", "Design studios", "Team project rooms"],
    accessibility: { stepFree: true, elevator: true, entrance: "w" },
    text: {
      en: { description: "The newest engineering building, with team rooms and a top-floor view over campus.", purpose: "First-year engineering, design studios and student project space.", why: "Foundations of Engineering meets here, and the team rooms are great for group work." },
      es: { description: "El edificio de ingeniería más nuevo, con salas de equipo y vistas del campus desde el último piso.", purpose: "Ingeniería de primer año, estudios de diseño y espacio para proyectos.", why: "Aquí se da Fundamentos de Ingeniería y hay salas ideales para trabajo en grupo." },
      zh: { description: "最新的工程学院大楼，设有小组工作室，顶楼可俯瞰校园。", purpose: "一年级工程课、设计工作室和学生项目空间。", why: "工程导论在这里上课，小组讨论室非常适合团队作业。" },
      hi: { description: "सबसे नई इंजीनियरिंग इमारत, जिसमें टीम रूम और ऊपरी मंज़िल से कैंपस का नज़ारा है।", purpose: "पहले वर्ष की इंजीनियरिंग, डिज़ाइन स्टूडियो और प्रोजेक्ट स्थान।", why: "Foundations of Engineering यहीं होती है और टीम रूम समूह काम के लिए बढ़िया हैं।" },
      ko: { description: "가장 최근에 지어진 공학관으로 팀 스터디룸과 꼭대기 층 전망이 있습니다.", purpose: "1학년 공학 수업, 디자인 스튜디오, 학생 프로젝트 공간.", why: "공학 입문 수업이 여기서 열리고 팀 프로젝트 하기 좋아요." },
    },
  },
];

// Dining (prototype data). `building` matches a map building name.
export const DINING = [
  { id: "d2", name: "D2", building: "Dietrick Hall", food: "comfort", dietary: ["veg", "halal"], prefs: ["quick", "healthy", "veg"], hours: [630, 1320] },
  { id: "deets", name: "Deet's Place", building: "Dietrick Hall", food: "coffee", dietary: ["veg"], prefs: ["quick", "late"], hours: [420, 1380] },
  { id: "westend", name: "West End Market", building: "West End Market", food: "grill", dietary: ["veg"], prefs: ["comfort", "late"], hours: [660, 1320] },
  { id: "turner", name: "Turner Place", building: "Lavery Hall", food: "international", dietary: ["veg", "vegan", "halal"], prefs: ["intl", "healthy", "veg"], hours: [600, 1200] },
  { id: "owens", name: "Owens Food Court", building: "Owens Hall", food: "quick", dietary: ["veg"], prefs: ["quick"], hours: [630, 1200] },
  { id: "perry", name: "Perry Place", building: "Hitt Hall", food: "quick", dietary: ["veg", "vegan"], prefs: ["quick", "healthy"], hours: [600, 1260] },
  { id: "squires-food", name: "Squires Food Court", building: "Squires Student Center", food: "quick", dietary: ["veg"], prefs: ["quick", "intl"], hours: [630, 1140] },
];

// Study spots, keyed to map buildings
export const STUDY_SPOTS = [
  { id: "newman-quiet", name: "Newman Library — quiet floors", building: "Newman Library", style: "quiet", hours: [420, 1380] },
  { id: "torg-bridge", name: "Torgersen Bridge", building: "Torgersen Hall", style: "quiet", hours: [420, 1380] },
  { id: "goodwin-team", name: "Goodwin Hall team rooms", building: "Goodwin Hall", style: "group", hours: [420, 1320] },
  { id: "glc", name: "Graduate Life Center lounge", building: "Graduate Life Center", style: "quiet", hours: [480, 1320] },
  { id: "squires-lounge", name: "Squires lounges", building: "Squires Student Center", style: "group", hours: [420, 1380] },
  { id: "drillfield-lawn", name: "The Drillfield lawn", building: "Drillfield", style: "outdoor", hours: [360, 1260] },
  { id: "hitt-commons", name: "Hitt Hall commons", building: "Hitt Hall", style: "cafe", hours: [420, 1320] },
];

// Clubs (prototype data)
export const CLUBS = [
  { id: "acm", name: "ACM at Virginia Tech", majors: ["Computer Science", "Computer Engineering"], interests: ["hackathons", "research"], building: "McBryde Hall" },
  { id: "vthacks", name: "VTHacks / HackViolet", majors: ["Computer Science", "Computer Engineering", "Business"], interests: ["hackathons", "entrepreneurship"], building: "Torgersen Hall" },
  { id: "esports", name: "Virginia Tech Esports", majors: [], interests: ["gaming", "esports"], building: "Squires Student Center" },
  { id: "cyber", name: "Cyber@VT", majors: ["Computer Science", "Computer Engineering"], interests: ["hackathons", "research"], building: "Torgersen Hall" },
  { id: "recsports", name: "Intramural Sports", majors: [], interests: ["fitness", "sports"], building: "McComas Hall" },
  { id: "outdoor", name: "Venture Out / Outdoor Club", majors: [], interests: ["outdoors", "fitness"], building: "Squires Student Center" },
  { id: "marching", name: "The Marching Virginians", majors: [], interests: ["music"], building: "Squires Student Center" },
  { id: "entrepreneur", name: "Entrepreneur Club", majors: ["Business"], interests: ["entrepreneurship"], building: "Pamplin Hall" },
  { id: "volunteer", name: "VT Engage volunteering", majors: [], interests: ["volunteering"], building: "Squires Student Center" },
  { id: "robotics", name: "Robotics Club", majors: ["Mechanical Engineering", "Computer Engineering"], interests: ["research", "hackathons"], building: "Goodwin Hall" },
  { id: "art", name: "Student Art Collective", majors: ["Architecture"], interests: ["art"], building: "Center for the Arts at Virginia Tech" },
];

// First-week events (prototype data). day: 1 = Monday … 5 = Friday; start/end in minutes.
export const EVENTS = [
  { id: "gobblerfest", name: "Gobblerfest club fair", day: 5, start: 960, end: 1200, building: "Drillfield", interests: ["hackathons", "gaming", "music", "volunteering", "sports", "art"], category: "explore" },
  { id: "acm-kickoff", name: "ACM semester kickoff", day: 2, start: 1140, end: 1260, building: "McBryde Hall", interests: ["hackathons", "research"], category: "clubs" },
  { id: "esports-open", name: "Esports open play night", day: 3, start: 1200, end: 1380, building: "Squires Student Center", interests: ["gaming", "esports"], category: "clubs" },
  { id: "rec-openhouse", name: "Rec Sports open house", day: 2, start: 1020, end: 1200, building: "McComas Hall", interests: ["fitness", "sports"], category: "explore" },
  { id: "library-tour", name: "Newman Library drop-in tour", day: 1, start: 900, end: 960, building: "Newman Library", interests: [], category: "resources" },
  { id: "hacknight", name: "VTHacks info + hack night", day: 4, start: 1140, end: 1320, building: "Torgersen Hall", interests: ["hackathons", "entrepreneurship"], category: "clubs" },
  { id: "moss-concert", name: "Student showcase concert", day: 4, start: 1170, end: 1290, building: "Center for the Arts at Virginia Tech", interests: ["music", "art"], category: "explore" },
  { id: "intl-mixer", name: "International student mixer", day: 3, start: 1020, end: 1140, building: "Squires Student Center", interests: [], category: "resources" },
];

// Campus resources (prototype data). `needs` links them to accessibility answers.
export const RESOURCES = [
  { id: "passport", name: "Hokie Passport (student ID)", building: "Student Services Building", taskKey: "task_passport", needs: [] },
  { id: "advising", name: "Academic advising", building: "Burruss Hall", taskKey: "task_advising", needs: [] },
  { id: "career", name: "Career & Professional Development", building: "Smith Career Center", taskKey: "task_career", needs: [] },
  { id: "counseling", name: "Cook Counseling Center", building: "McComas Hall", taskKey: null, needs: [] },
  { id: "ssd", name: "Services for Students with Disabilities", building: "Student Services Building", taskKey: "task_access", needs: ["stepfree", "limited", "vision", "hearing"] },
  { id: "cultural", name: "Cultural and community centers", building: "Squires Student Center", taskKey: null, needs: [] },
  { id: "library-help", name: "Library research help", building: "Newman Library", taskKey: "task_library", needs: [] },
];

export const INTERESTS = ["hackathons", "gaming", "fitness", "sports", "music", "art", "outdoors", "research", "volunteering", "entrepreneurship"];

// Majors, their course prefix, home building, and a typical first-semester schedule.
// days: 1 = Monday … 5 = Friday. start/end are minutes after midnight.
export const MAJORS = [
  {
    name: "Computer Science", dept: "CS", building: "McBryde Hall",
    schedule: [
      { course: "CS 1114 Intro to Software Design", building: "McBryde Hall", days: [1, 3, 5], start: 545, end: 595 },
      { course: "ENGE 1215 Foundations of Engineering", building: "Goodwin Hall", days: [1, 3], start: 660, end: 735 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [2, 4], start: 570, end: 645 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
  {
    name: "Computer Engineering", dept: "ECE", building: "Whittemore Hall",
    schedule: [
      { course: "ECE 1004 Intro to ECE", building: "Whittemore Hall", days: [1, 3, 5], start: 545, end: 595 },
      { course: "ENGE 1215 Foundations of Engineering", building: "Goodwin Hall", days: [1, 3], start: 660, end: 735 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [2, 4], start: 570, end: 645 },
      { course: "PHYS 2305 Physics", building: "Robeson Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
  {
    name: "Business", dept: "BIT", building: "Pamplin Hall",
    schedule: [
      { course: "BIT 1214 Business Analytics", building: "Pamplin Hall", days: [1, 3, 5], start: 605, end: 655 },
      { course: "ACIS 1504 Accounting Systems", building: "Pamplin Hall", days: [2, 4], start: 690, end: 765 },
      { course: "ECON 2005 Microeconomics", building: "Pamplin Hall", days: [1, 3], start: 780, end: 855 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 570, end: 645 },
    ],
  },
  {
    name: "Biology", dept: "BIOL", building: "Derring Hall",
    schedule: [
      { course: "BIOL 1105 Principles of Biology", building: "Derring Hall", days: [1, 3, 5], start: 545, end: 595 },
      { course: "CHEM 1035 General Chemistry", building: "Davidson Hall", days: [1, 3, 5], start: 665, end: 715 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [2, 4], start: 570, end: 645 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
  {
    name: "Psychology", dept: "PSYC", building: "Williams Hall",
    schedule: [
      { course: "PSYC 1004 Intro Psychology", building: "Williams Hall", days: [1, 3], start: 605, end: 680 },
      { course: "SOC 1004 Intro Sociology", building: "McBryde Hall", days: [2, 4], start: 570, end: 645 },
      { course: "STAT 3604 Statistics", building: "Hutcheson Hall", days: [1, 3, 5], start: 725, end: 775 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
  {
    name: "Mechanical Engineering", dept: "ME", building: "Goodwin Hall",
    schedule: [
      { course: "ENGE 1215 Foundations of Engineering", building: "Goodwin Hall", days: [1, 3], start: 545, end: 620 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [2, 4], start: 570, end: 645 },
      { course: "PHYS 2305 Physics", building: "Robeson Hall", days: [1, 3, 5], start: 725, end: 775 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
  {
    name: "Architecture", dept: "ARCH", building: "Cowgill Hall",
    schedule: [
      { course: "ARCH 1015 Foundation Design Lab", building: "Cowgill Hall", days: [1, 3, 5], start: 780, end: 960 },
      { course: "ARCH 1044 Design Communication", building: "Cowgill Hall", days: [2, 4], start: 570, end: 645 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [2, 4], start: 690, end: 765 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [1, 3], start: 660, end: 735 },
    ],
  },
  {
    name: "Exploring / Undecided", dept: "UNIV", building: "Squires Student Center",
    schedule: [
      { course: "UNIV 1004 First-Year Experience", building: "Squires Student Center", days: [1, 3], start: 605, end: 680 },
      { course: "ENGL 1105 First-Year Writing", building: "Shanks Hall", days: [2, 4], start: 570, end: 645 },
      { course: "MATH 1225 Calculus", building: "McBryde Hall", days: [1, 3, 5], start: 725, end: 775 },
      { course: "PSYC 1004 Intro Psychology", building: "Williams Hall", days: [2, 4], start: 750, end: 825 },
    ],
  },
];

// Residence halls offered during onboarding (all exist on the map)
export const RESIDENCE_HALLS = [
  "Pritchard Hall", "West Ambler Johnston Hall", "East Ambler Johnston Hall", "Lee Hall", "Campbell Hall",
  "Payne Hall", "O'Shaughnessy Hall", "Miles Hall", "Johnson Hall", "Slusher Hall", "New Hall West",
  "Creativity and Innovation District Residence Hall", "Upper Quad Hall North", "Peddrew-Yates Hall", "Whitehurst Hall",
];

export const byId = (list, id) => list.find((x) => x.id === id) ?? null;
export const placeById = (id) => PLACES.find((p) => p.id === id) ?? null;
export const placeForBuilding = (name) => PLACES.find((p) => p.mapName === name && p.kind !== "landmark") ?? null;
