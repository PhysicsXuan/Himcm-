const groups = [
  {
    code: 'A',
    name: '可实现机会',
    description: '周末能通过步行或公交到达的学习、运动和文化活动。',
    questions: [
      '周末能方便到达图书馆、城市书房、博物馆或科技馆。',
      '周末能方便到达公园和公共运动场馆。',
      '周末能方便到达文化馆、青少年宫等社交文化活动场所。',
    ],
  },
  {
    code: 'H',
    name: '健康与医疗',
    description: '良好的城市环境，以及方便、可靠的医疗服务。',
    questions: [
      '城市空气质量好、环境整洁，适合青少年健康生活。',
      '从居住地或学校去医院、社区医疗点比较方便。',
      '医疗服务可靠，青少年生病时能及时获得合适的诊疗。',
    ],
  },
  {
    code: 'F',
    name: '家庭住房负担',
    description: '住房开支合理，家庭支付住房费用后仍能维持日常生活。',
    questions: [
      '普通家庭在城市里租房或承担住房开支不会太困难。',
      '家庭支付住房开支后，仍能负担日常生活所需。',
      '住房成本不会让收入较低的家庭难以稳定居住。',
    ],
  },
  {
    code: 'E',
    name: '教育支持',
    description: '高中师资充足稳定，学生能够获得及时的学习指导。',
    questions: [
      '高中老师数量充足，学生遇到学习问题时能得到指导。',
      '各学科师资稳定，不会长期因老师不足影响学习。',
      '老师有足够精力关注学生的学习和成长需要。',
    ],
  },
];

const form = document.querySelector('#survey-form');
const groupsRoot = document.querySelector('#question-groups');
const progressCount = document.querySelector('#progress-count');
const progressFill = document.querySelector('#progress-fill');
const submitButton = document.querySelector('#submit-button');
const formMessage = document.querySelector('#form-message');
const resultPanel = document.querySelector('#result-panel');
const resultRows = document.querySelector('#result-rows');

function renderQuestions() {
  let questionNumber = 1;
  for (const group of groups) {
    const section = document.createElement('section');
    section.className = `factor-section factor-${group.code.toLowerCase()}`;

    const heading = document.createElement('div');
    heading.className = 'factor-heading';
    const label = document.createElement('span');
    label.className = 'factor-code';
    label.textContent = group.code;
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = group.name;
    const description = document.createElement('p');
    description.textContent = group.description;
    titleWrap.append(title, description);
    heading.append(label, titleWrap);
    section.append(heading);

    for (const questionText of group.questions) {
      const questionId = `q${questionNumber}`;
      const question = document.createElement('fieldset');
      question.className = 'question-row';

      const legend = document.createElement('legend');
      const number = document.createElement('span');
      number.className = 'question-number';
      number.textContent = String(questionNumber).padStart(2, '0');
      const prompt = document.createElement('span');
      prompt.className = 'question-prompt';
      prompt.textContent = `当你判断一座城市是否适合青少年生活时，${questionText} 这有多重要？`;
      legend.append(number, prompt);
      question.append(legend);

      const options = document.createElement('div');
      options.className = 'rating-options';
      for (let score = 1; score <= 5; score += 1) {
        const optionId = `${questionId}-${score}`;
        const input = document.createElement('input');
        input.type = 'radio';
        input.id = optionId;
        input.name = questionId;
        input.value = String(score);
        input.required = true;
        input.setAttribute('aria-label', `${questionId}，${score}分`);
        const optionLabel = document.createElement('label');
        optionLabel.htmlFor = optionId;
        optionLabel.textContent = String(score);
        options.append(input, optionLabel);
      }
      question.append(options);
      section.append(question);
      questionNumber += 1;
    }
    groupsRoot.append(section);
  }
}

function currentAnswers() {
  const answers = {};
  for (let number = 1; number <= 12; number += 1) {
    const selected = form.querySelector(`input[name="q${number}"]:checked`);
    if (selected) answers[`q${number}`] = Number(selected.value);
  }
  return answers;
}

function updateProgress() {
  const count = Object.keys(currentAnswers()).length;
  progressCount.textContent = `${count} / 12`;
  progressFill.style.width = `${(count / 12) * 100}%`;
  submitButton.disabled = count !== 12;
}

function showResults(result) {
  const labels = {
    A: '可实现机会',
    H: '健康与医疗',
    F: '家庭住房负担',
    E: '教育支持',
  };
  resultRows.replaceChildren();
  for (const code of ['A', 'H', 'F', 'E']) {
    const row = document.createElement('div');
    row.className = `result-row factor-${code.toLowerCase()}`;
    const title = document.createElement('div');
    title.className = 'result-name';
    const codeLabel = document.createElement('span');
    codeLabel.className = 'factor-code';
    codeLabel.textContent = code;
    const name = document.createElement('span');
    name.textContent = labels[code];
    title.append(codeLabel, name);

    const track = document.createElement('div');
    track.className = 'result-track';
    const fill = document.createElement('div');
    fill.className = 'result-fill';
    fill.style.width = `${result.weights[code] * 10}%`;
    track.append(fill);

    const score = document.createElement('strong');
    score.className = 'result-score';
    score.textContent = `${result.weights[code].toFixed(1)} / 10`;
    row.append(title, track, score);
    resultRows.append(row);
  }
  form.hidden = true;
  document.querySelector('.scale-band').hidden = true;
  document.querySelector('.progress-wrap').hidden = true;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

groupsRoot.addEventListener('change', updateProgress);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const answers = currentAnswers();
  if (Object.keys(answers).length !== 12) {
    formMessage.textContent = '请完成全部12题。';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = '正在提交…';
  formMessage.textContent = '';
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '提交失败，请重试。');
    showResults(payload);
  } catch (error) {
    formMessage.textContent = error.message;
    submitButton.disabled = false;
    submitButton.textContent = '提交并查看权重';
  }
});

document.querySelector('#restart-button').addEventListener('click', () => {
  form.reset();
  form.hidden = false;
  resultPanel.hidden = true;
  document.querySelector('.scale-band').hidden = false;
  document.querySelector('.progress-wrap').hidden = false;
  formMessage.textContent = '';
  submitButton.textContent = '提交并查看权重';
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

renderQuestions();
updateProgress();
