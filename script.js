const app = {};

app.score = 0;
app.round = 1;
app.answered = 0;
app.answeredCorrectly = 0;
app.answeredIncorrectly = 0;
app.unanswered = 0;
app.totalWon = 0;
app.totalLost = 0;
app.secondsElapsed = 0;
app.timerMax = 30;
app.timer = app.timerMax;

app.cacheSelectors = () => {
    app.$header = $('header');
    app.$headerP = $('header > p');
    app.$h1 = $('h1');
    app.$board = $('.board');
    app.$startGame = $('#startGame');
    app.$answerScreen = $('.answerScreen');
    app.$answerForm = $('#answerForm');
    app.$playerAnswer = $('#playerAnswer');
    app.$passButton = $('#passButton');
    app.$timer = $('.timer');
    app.$nextQuestion = $('#nextQuestion');
    app.$wagerForm = $('#wagerForm');
    app.$wager = $('#wager');
    app.$score = $('#score');
    app.$finalStats = $('.finalStats');
};

app.addEventListeners = () => {

    app.$answerForm.on('submit', (e) => {
        e.preventDefault();
        const playerAnswer = app.$playerAnswer.val();
        const result = app.checkAnswer(playerAnswer);
        app.questionIsAnswered(result);
    });

    app.$passButton.on('click', (e) => {
        e.preventDefault();
        app.questionIsAnswered('unanswered');
    });

    app.$nextQuestion.on('click', () => {
        app.$activeQuestion.toggleClass('questionActive answered');
        app.$activeQuestion.off();
        app.$activeQuestion = undefined;
        app.activeQuestion = undefined;
        app.$nextQuestion.addClass('hidden');
        app.$timer.text(app.timerMax);
        app.$timer.addClass('hidden');
        app.$answerScreen.removeClass('open');
        app.checkForEndOfRound();
    });

    $('#newGameBtn').on('click', () => {
        app.closeCurtain();
        app.resetGame();
    });

    app.$startGame.on('click', () => {
        if (app.round === 1) {
            app.timeCounter = setInterval(() => { app.secondsElapsed++; }, 1000);
        } else if (app.round > 3) {
            app.resetGame();
        };
        app.openCurtain();
    });

    app.$wagerForm.on('submit', (e) => {
        e.preventDefault();
        let wager = parseInt(app.$wager.val());
        if (!wager) {
            wager = parseInt(app.$wager.attr('min'));
        }
        app.activeQuestion.value = wager;
        app.$wagerForm.addClass('hidden');
        if(app.round >= 3) { // Final Jeopardy
            app.$activeQuestion.toggleClass('questionActive');
            app.positionOpenQuestion();
            app.$activeQuestion.children().toggleClass('hidden');
            setTimeout(app.openAnswerForm, 300);
        } else { // Daily Double
            app.$activeQuestion.children('h3').addClass('hidden').removeClass('dailyDouble');
            app.$activeQuestion.children('p').removeClass('hidden');
            app.openAnswerForm();
        };
        app.$passButton.addClass('hidden');  
    });
};

app.generateCategories = (numberOfCategories = 6) => {
    const offset = app.generateRandomNumber(18000);
    const categoryPromise = app.getCategories(numberOfCategories, offset);
    categoryPromise.done((response) => {
        let noMissingCategories = true;
        for (let i = 0; i < numberOfCategories; i++) {
            const currentCategory = response[i];
            const currentTitle = currentCategory.title.toLowerCase();
            if (currentTitle.includes('missing this category')) {
                noMissingCategories = false;
                break;
            };
        };
        if (noMissingCategories) {
            app.categories = response;
            app.populateCategories();
            if (numberOfCategories === 1) {
                app.getSingleClue();
            } else {
                app.getClues();
            };
        } else {
            app.generateCategories(numberOfCategories);
        }
    });
};

app.generateRandomNumber = (max) => {
    return Math.floor(Math.random() * max);
};

app.getCategories = (count, offset) => {
    const categoryPromise = $.ajax({
        url: `https://jservice.io/api/categories?count=${count}&offset=${offset}`,
        method: 'GET',
        dataType: 'json',
    });
    return categoryPromise;
};

app.populateCategories = () => {
    for (let i = 0; i < app.categories.length; i++) {
        $(`#cat${i + 1} h2`).text(app.categories[i].title);
    };
};

app.getSingleClue = () => {
    const cluePromise = app.getClueData(app.categories[0].id);
    cluePromise.done((response) => {
        app.categories[0].clues = response;
        app.checkReadyToPopulate(1);
    });
};

app.getClues = () => {
    const cluePromises = [];
    for (let i = 0; i < app.categories.length; i++) {
        cluePromises.push(app.getClueData(app.categories[i].id));
    }
    
    $.when(cluePromises[0], cluePromises[1], cluePromises[2], cluePromises[3], cluePromises[4], cluePromises[5]).done((response1, response2, response3, response4, response5, response6) => {
        app.categories[0].clues = response1[0];
        app.categories[1].clues = response2[0];
        app.categories[2].clues = response3[0];
        app.categories[3].clues = response4[0];
        app.categories[4].clues = response5[0];
        app.categories[5].clues = response6[0];
        app.checkReadyToPopulate();
    })
};

app.getClueData = (category) => {
    const cluesPromise = $.ajax({
        url: `https://jservice.io/api/clues?category=${category}`,
        method: 'GET',
        dataType: 'json',
    });
    return cluesPromise;
};

app.checkReadyToPopulate = (categories = 6) => {
    if (app.checkForEmptyQuestions()) {
        app.generateCategories(categories);
    } else {
        app.populateClues();
    }
};

app.checkForEmptyQuestions = () => {
    for (let i = 0; i < app.categories.length; i++) {
        for (let j = 0; j < app.categories[i].clues.length; j++) {
            const question = app.categories[i].clues[j].question.toLowerCase();
            if (question === '' || question.includes('seen here')) {
                return true;
            };
        };
    };
    return false;
};

app.populateClues = () => {
    if (app.round >= 3) {
        app.populateFinalJeopardy();
    } else {
        app.adjustClueValues();
        app.chooseDailyDouble();
        for (let i = 0; i < app.categories.length; i++) {
            for (let j = 0; j < app.categories[i].clues.length; j++) {
                $(`#cat${i + 1} .clue${j + 1} h3`).text(app.categories[i].clues[j].value);
                $(`#cat${i + 1} .clue${j + 1} h4`).text(app.categories[i].title);
                $(`#cat${i + 1} .clue${j + 1} p`).text(app.categories[i].clues[j].question);
                $(`#cat${i + 1} .clue${j + 1}`).on('click', function () {
    
                    if (!app.activeQuestion) {
                        app.activeQuestion = app.categories[i].clues[j];
                        app.$activeQuestion = $(this);
                        app.$activeQuestion.toggleClass('questionActive');
                        app.positionOpenQuestion();

                        if (app.activeQuestion.dailyDouble) {
                            app.$activeQuestion.children('h3').addClass('dailyDouble').removeClass('hidden').text('Daily Double!');
                            app.$activeQuestion.children('h4').removeClass('hidden');
                            app.openWagerForm();
                        } else {
                            app.$activeQuestion.children().toggleClass('hidden');
                            app.$passButton.removeClass('hidden');
                            app.$answerScreen.toggleClass('open');
                            setTimeout(app.openAnswerForm, 300);
                        };
    
                    };
    
                });
            };
        };
    };
};

app.populateFinalJeopardy = () => {
    let mostDifficultClue = 0;
    let mostValuableClue = 0;
    for (let i = 0; i < app.categories[0].clues.length; i++) {
        if (app.categories[0].clues[i].value > mostValuableClue) {
            mostValuableClue = app.categories[0].clues[i].value;
            mostDifficultClue = i;
        };
    };
    $('#cat1 .clue1 h3').text('?');
    $(`#cat1 .clue1 h4`).text(app.categories[0].title);
    $(`#cat1 .clue1 p`).text(app.categories[0].clues[mostDifficultClue].question);
    $('#cat1 .clue1').on('click', function () {
        if (!app.activeQuestion) {
            app.activeQuestion = app.categories[0].clues[mostDifficultClue];
            app.$activeQuestion = $(this);
            app.openWagerForm();
        };
    });
};

app.adjustClueValues = () => {
    for (let i = 0; i < app.categories.length; i++) {
        app.categories[i].clues[0].value = 200 * app.round;
        app.categories[i].clues[1].value = 400 * app.round;
        app.categories[i].clues[2].value = 600 * app.round;
        app.categories[i].clues[3].value = 800 * app.round;
        app.categories[i].clues[4].value = 1000 * app.round;
    };
};

app.chooseDailyDouble = () => {
    const dailyDoubleCategory = app.generateRandomNumber(6);
    const dailyDoubleClue = app.generateRandomNumber(5);
    app.categories[dailyDoubleCategory].clues[dailyDoubleClue].dailyDouble = true;
};

app.positionOpenQuestion = () => {
    const clueCentre = [app.$activeQuestion.width() / 2, app.$activeQuestion.height() / 2];
    const cluePosition = [app.$activeQuestion.position().left, app.$activeQuestion.position().top];

    const translateX = (app.boardCentre[0] - clueCentre[0] - cluePosition[0]);
    const translateY = (app.boardCentre[1] - (clueCentre[1] * 4.5) - cluePosition[1]);

    app.$activeQuestion.css('--x', `${translateX}px`);
    app.$activeQuestion.css('--y', `${translateY}px`);
};

app.openWagerForm = () => {
    app.$answerScreen.toggleClass('open');
    setTimeout(() => {
        app.$wagerForm.toggleClass('hidden');
        app.$wager.focus();
    }, 300);

    if (app.round >= 3) { // Final Jeopardy
        app.$wager.attr('min', 0);
        if (app.score <= 0) {
            app.$wager.attr('max', 0);
        } else {
            app.$wager.attr('max', app.score);
        };
    } else { // Daily Double
        let wagerMax;
        if (app.round === 2) {
            wagerMax = 2000;
        } else {
            wagerMax = 1000;
        };
        if (app.score > wagerMax) {
            wagerMax = app.score;
        };
        app.$wager.attr('min', 5);
        app.$wager.attr('max', wagerMax);
    };
    app.$wager.val(app.$wager.attr('min'));
};

app.checkAnswer = (playerAnswer) => {
    const formattedPlayerAnswer = app.formatAnswer(playerAnswer);

    let formattedAnswer;
    const bracketIndex = app.activeQuestion.answer.indexOf('(');
    if (bracketIndex !== -1) {
        const secondBracketIndex = app.activeQuestion.answer.indexOf(')');
        const answerWithinBrackets = app.activeQuestion.answer.substring(bracketIndex + 1, secondBracketIndex);
        const answerWithoutBrackets = app.activeQuestion.answer.replace(answerWithinBrackets, '');
        const formattedAnswerWithoutBrackets = app.formatAnswer(answerWithoutBrackets);
        const answerWithinBracketsAcceptRemoved = answerWithinBrackets.replace('accepted', '').replace('accept', '');
        const formattedAnswerWithinBrackets = app.formatAnswer(answerWithinBracketsAcceptRemoved);

        if (formattedPlayerAnswer === formattedAnswerWithoutBrackets || formattedPlayerAnswer === formattedAnswerWithinBrackets || formattedAnswer === formattedAnswerWithinBrackets + formattedAnswerWithoutBrackets || formattedAnswer === formattedAnswerWithoutBrackets + formattedAnswerWithinBrackets) {
            return true;
        } else {
            return false;
        };
        
    } else {
        formattedAnswer = app.formatAnswer(app.activeQuestion.answer);
        if(formattedPlayerAnswer === formattedAnswer) {
            return true;
        } else {
            return false;
        };
    };
};

app.formatAnswer = (answer) => {
    const lowercaseAnswer = ` ${answer.toLowerCase()} `;
    const removePunctuation = lowercaseAnswer.replace(/!/g, '').replace(/,/g, '').replace(/\./g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/'/g, '').replace(/"/g, '').replace(/:/g, '').replace(/\//g, '').replace(/\\/g, '').replace(/\$/g, '');
    const removeSymbols = removePunctuation.replace(/<i>/g, '').replace(/<.*>/g, '').replace(/</g, '').replace(/>/g, '').replace(/&/g, '').replace(/-/g, '').replace(/\?/g, '');
    const removePrepositions = removeSymbols.replace(/ and /g, ' ').replace(/ the /g, ' ').replace(/ a /g, ' ').replace(/ an /g, ' ').replace(/ or /g, ' ').replace(/ is /g, ' ').replace(/ was /g, ' ').replace(/ it /g, ' ').replace(/ also /g, ' ').replace(/s /g, '').replace(/ your /g, ' ');
    const replaceAccents = removePrepositions.replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/ë/g, 'e').replace(/ñ/g, 'n').replace(/ç/g, 'c').replace(/à/g, 'a').replace(/á/g, 'a').replace(/â/g, 'a').replace(/ã/g, 'a').replace(/ä/g, 'a').replace(/å/g, 'a').replace(/æ/g, 'ae').replace(/ì/g, 'i').replace(/í/g, 'i').replace(/î/g, 'i').replace(/ï/g, 'i').replace(/ò/g, 'o').replace(/ó/g, 'o').replace(/ô/g, 'o').replace(/õ/g, 'o').replace(/ö/g, 'o').replace(/ù/g, 'u').replace(/ú/g, 'u').replace(/û/g, 'u').replace(/ü/g, 'u');
    const removeSpaces = replaceAccents.replace(/ /g, '');
    return removeSpaces;
};

app.openAnswerForm = () => {
    app.$answerForm.removeClass('hidden');
    app.$playerAnswer.focus();
    app.$timer.removeClass('hidden');
    app.timerInterval = setInterval(app.updateTimer, 1000);
};

app.updateTimer = () => {
    app.timer--;
    app.$timer.text(app.timer);
    if (app.timer <= 0) {
        if (app.round >= 3) {
            app.questionIsAnswered(false);
        } else {
            app.questionIsAnswered('unanswered');
        };
    };
};

app.questionIsAnswered = (result) => {
    clearInterval(app.timerInterval);
    app.answered++;
    if (result === true) {
        app.score += app.activeQuestion.value;
        app.totalWon += app.activeQuestion.value;
        app.answeredCorrectly++;
        app.$timer.text('Correct!');
    } else if (result === false) {
        app.score -= app.activeQuestion.value;
        app.totalLost += app.activeQuestion.value;
        app.answeredIncorrectly++;
        app.$timer.text('Wrong!');
    } else {
        app.unanswered++;
    };
    app.updateScoreDisplay();
    app.timer = app.timerMax;
    const reformattedAnswer = app.activeQuestion.answer.replace(/\//g, '').replace(/\\/g, '').replace(/<i>/g, '');
    app.$activeQuestion.children('p').text(reformattedAnswer);
    app.$activeQuestion.children('h4').addClass('hidden');
    app.$playerAnswer.val('');
    app.$answerForm.addClass('hidden');
    if (app.round >= 3) {
        app.$nextQuestion.text('End Game');
    };
    app.$nextQuestion.removeClass('hidden');
};

app.updateScoreDisplay = () => {
    app.$score.text(app.score);
};

app.checkForEndOfRound = () => {
    if (app.round >= 3) {
        app.gameOver();
    } else if(app.answered >= 30) {
        app.answered = 0;
        app.round++;
        app.resetBoard();
        if(app.round > 2) {
            app.finalJeopardy();
        } else {
            app.doubleJeopardy();
        };
    };
};

app.doubleJeopardy = () => {
    app.$headerP.text('Get Ready For');
    app.$h1.text('Double Jeopardy!');
    app.$startGame.text('Begin Round');
    setTimeout(() => { 
        app.closeCurtain();
        app.generateCategories();
    }, 300);
};

app.finalJeopardy = () => {
    app.$headerP.text('Get Ready For');
    app.$h1.text('Final Jeopardy!');
    app.$startGame.text('Begin Round');
    setTimeout(() => { 
        app.closeCurtain();
        app.generateCategories(1);
    }, 300);
};

app.closeCurtain = () => {
    app.$header.toggleClass('openCurtain');
    app.$header.children().not('.finalStats').fadeIn();
};

app.openCurtain = () => {
    app.$header.toggleClass('openCurtain');
    app.$header.children().not('.finalStats').fadeOut();
};

app.resetBoard = () => {
    for (let i = 0; i < app.categories.length; i++) {
        $(`#cat${i + 1} h2`).text('');
        for (let j = 0; j < app.categories[i].clues.length; j++) {
            const $currentQuestion = $(`#cat${i + 1} .clue${j + 1}`);
            $currentQuestion.removeClass('questionActive');
            $currentQuestion.removeClass('answered');
            $currentQuestion.children('h3').text('');
            $currentQuestion.children('h3').removeClass('hidden');
            $currentQuestion.children('h4').addClass('hidden');
            $currentQuestion.children('p').addClass('hidden');
        };
    };
};

app.resetGame = () => {
    clearInterval(app.timerInterval);
    clearInterval(app.timeCounter);
    app.timer = app.timerMax;
    app.$timer.text(app.timer);
    app.activeQuestion = undefined;
    app.$activeQuestion = undefined;
    app.$finalStats.fadeOut();
    app.$headerP.text('A tribute to');
    app.$h1.text('Jeopardy!');
    app.$startGame.text('Start Game');
    app.$answerScreen.removeClass('open');
    app.$answerForm.addClass('hidden');
    app.$nextQuestion.text('Next Question');
    app.$nextQuestion.addClass('hidden');
    app.$playerAnswer.val('');
    app.$timer.addClass('hidden');
    app.score = 0;
    app.round = 1;
    app.answered = 0;
    app.answeredCorrectly = 0;
    app.answeredIncorrectly = 0;
    app.unanswered = 0;
    app.totalWon = 0;
    app.totalLost = 0;
    app.secondsElapsed = 0;
    app.updateScoreDisplay();
    app.resetBoard();
    app.generateCategories();
};

app.gameOver = () => {
    app.round++;
    clearInterval(app.timeCounter);
    let minutesPlayed = (app.secondsElapsed - (app.secondsElapsed % 60)) / 60;
    let secondsPlayed = app.secondsElapsed % 60;
    const accuracy = ((app.answeredCorrectly / (app.answeredCorrectly + app.answeredIncorrectly + app.unanswered)) * 100).toFixed(2);
    const finalStats = `
        <p>Final Score: <span>$${app.score}</span></p>
        <p>Correct Answers: <span>${app.answeredCorrectly}</span></p>
        <p>Incorrect Answers: <span>${app.answeredIncorrectly}</span></p>
        <p>Unanswered: <span>${app.unanswered}</span></p>
        <p>Accuracy: <span>${accuracy}%</span></p>
        <p>Total Money Won: <span>$${app.totalWon}</span></p>
        <p>Total Money Lost: <span>$${app.totalLost}</span></p>
        <p>Time Played: <span>${minutesPlayed} min ${secondsPlayed} sec</span></p>
    `;
    app.$finalStats.html(finalStats);
    app.$h1.text('Jeopardy!')
    app.$headerP.text('Thanks for Playing!');
    app.$startGame.text('Play Again');
    setTimeout(() => {
        app.$finalStats.fadeIn();
        app.closeCurtain();
    }, 300);
};

app.init = () => {
    app.cacheSelectors();
    const boardWidth = app.$board.width();
    const boardHeight = app.$board.height();
    app.boardCentre = [boardWidth / 2, boardHeight / 2];
    app.addEventListeners();
    app.generateCategories();
};


window.onload = function() {
    app.init();
}
