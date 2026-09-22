/* Hareket (egzersiz) verisi.
   Satır biçimi: [ad, kategori]
   Kategoriler günlük antrenman akışına göre gruplanır (aşağıdaki HAREKET_KATEGORI_SIRA ile aynı sıra). */
(function (root) {
  var G = 'Göğüs', SI = 'Sırt', O = 'Omuz', BI = 'Biceps', TR = 'Triceps',
      BA = 'Bacak', K = 'Karın', KAR = 'Kardiyo', TV = 'Tüm vücut/Fonksiyonel', ES = 'Esneklik/Mobilite';

  root.EXERCISE_ROWS = [
    /* ---- Göğüs ---- */
    ['Bench Press (Barbell)', G], ['Eğimli Bench Press (Incline)', G], ['Dumbbell Press', G],
    ['Dumbbell Fly (Göğüs açma)', G], ['Şınav (Push-up)', G], ['Cable Crossover', G],
    ['Dips (göğüs ağırlıklı)', G], ['Pec Deck (Machine Fly)', G], ['Düz Bench Press (Dumbbell)', G],

    /* ---- Sırt ---- */
    ['Deadlift', SI], ['Barfiks (Pull-up)', SI], ['Lat Pulldown', SI], ['Barbell Row (Eğilerek çekiş)', SI],
    ['Dumbbell Row (Tek kol çekiş)', SI], ['Oturarak Kablo Çekiş (Seated Cable Row)', SI],
    ['T-Bar Row', SI], ['Hyperextension', SI], ['Assisted Pull-up (Destekli barfiks)', SI],

    /* ---- Omuz ---- */
    ['Overhead Press (Barbell)', O], ['Dumbbell Shoulder Press', O], ['Yan Kaldırış (Lateral Raise)', O],
    ['Ön Kaldırış (Front Raise)', O], ['Arka Omuz Açma (Rear Delt Fly)', O], ['Arnold Press', O],
    ['Upright Row', O], ['Shrug (Trapez)', O], ['Face Pull', O],

    /* ---- Biceps ---- */
    ['Barbell Curl', BI], ['Dumbbell Curl', BI], ['Hammer Curl', BI], ['Preacher Curl', BI],
    ['Cable Curl', BI], ['Concentration Curl', BI], ['21s Curl', BI],

    /* ---- Triceps ---- */
    ['Triceps Pushdown (Kablo)', TR], ['Skull Crusher', TR], ['Close-Grip Bench Press', TR],
    ['Overhead Triceps Extension', TR], ['Dips (triceps ağırlıklı)', TR], ['Triceps Kickback', TR],

    /* ---- Bacak ---- */
    ['Squat (Barbell)', BA], ['Leg Press', BA], ['Lunge (Hamle)', BA], ['Romanian Deadlift', BA],
    ['Leg Extension', BA], ['Leg Curl', BA], ['Calf Raise (Baldır)', BA], ['Bulgarian Split Squat', BA],
    ['Hip Thrust', BA], ['Goblet Squat', BA], ['Hack Squat', BA],

    /* ---- Karın ---- */
    ['Plank', K], ['Mekik (Crunch)', K], ['Hanging Leg Raise', K], ['Russian Twist', K],
    ['Cable Crunch', K], ['Bicycle Crunch', K], ['Ab Wheel Rollout', K], ['Side Plank', K],

    /* ---- Kardiyo ---- */
    ['Koşu bandı', KAR], ['Açık havada koşu', KAR], ['Yürüyüş (tempolu)', KAR], ['Sabit bisiklet', KAR],
    ['Bisiklet (açık hava)', KAR], ['Eliptik bisiklet', KAR], ['İp atlama', KAR], ['Yüzme', KAR],
    ['Merdiven tırmanma (StairMaster)', KAR], ['Rowing Machine (Kürek)', KAR],

    /* ---- Tüm vücut / Fonksiyonel ---- */
    ['Burpee', TV], ['Kettlebell Swing', TV], ['Clean and Jerk', TV], ['Snatch', TV],
    ['Farmer\'s Walk', TV], ['Battle Rope', TV], ['Mountain Climber', TV], ['Thruster', TV],
    ['Box Jump', TV], ['Wall Ball', TV], ['Sled Push (İtme kızağı)', TV],

    /* ---- Esneklik / Mobilite ---- */
    ['Statik esneme (genel)', ES], ['Yoga', ES], ['Köpek pozisyonu (Downward Dog)', ES],
    ['Foam Rolling', ES], ['Dinamik ısınma', ES], ['Pilates', ES]
  ];
})(typeof window !== 'undefined' ? window : globalThis);
