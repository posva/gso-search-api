const axios = require('axios')
const google = require('google')
const restify = require('restify')

// vars
const port = process.env.PORT || 4000

const NotFoundError = restify.errors.NotFoundError

const server = restify.createServer()
// Allow requests from anywhere
server.use(restify.CORS())

server.get('/best-answer/:query', async (req, res, next) => {
  const { err, links } = await searchOnGoogle(req.params.query)
  if (err) return next(err)
  // now get the answers using SO api
  if (links.length > 0) {
    const question = parseQuestionId(links[0].link)
    res.send(await fetchAnswers(question))
    next()
  } else {
    next(new NotFoundError('No answers'))
  }
})

server.get('/questions/:query', async (req, res, next) => {
  const { err, links } = await searchOnGoogle(req.params.query)
  if (err) return next(err)
  res.send(links)
  next()
})

server.get('/answers/:questionId', async (req, res, next) => {
  res.send(await fetchAnswers(req.params.questionId))
  next()
})

server.listen(port, function () {
  console.log('%s listening at %s', server.name, server.url)
})

// Google
google.resultsPerPage = 40
function googleSearch (text) {
  return new Promise((resolve, reject) => {
    google(text, (err, { links }) => {
      if (err) return reject(err)
      resolve(links)
    })
  })
}

async function searchOnGoogle (text) {
  const searchQuery = `site:stackoverflow.com ${text}`
  try {
    // TODO handle error
    let links = await googleSearch(searchQuery)
    // todo get only so links
    links = links.filter(link => link.title !== '')
    return { links }
  } catch (err) {
    return { err }
  }
}

// SO
const questionRE = /^https?:\/\/(?:www)?stackoverflow.com\/questions\/(\d+)/
function parseQuestionId (link) {
  const match = link.match(questionRE)
  return match && match[1]
}

const seApi = axios.create({
  // API keys can be setup here
  baseURL: 'https://api.stackexchange.com/2.2'
})

async function fetchAnswers (question) {
  try {
    const { data } = await seApi.get(`/questions/${question}/answers`, {
      params: {
        order: 'desc',
        sort: 'votes',
        site: 'stackoverflow',
        // Filter to get answers as well
        filter: '!-*f(6s6U8Q9b'
      }
    })
    return data
  } catch (err) {
    return []
  }
}
