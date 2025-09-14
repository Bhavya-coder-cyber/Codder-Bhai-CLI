#!/usr/bin/env node
import 'dotenv/config';
import { OpenAI } from 'openai';
import axios from 'axios';

import { exec } from 'child_process';
import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";

console.log("Hello from Buddy CLI");
// Tool Functions
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));
export async function getWeatherDetailsByCity(cityname = '') {
    const url = `https://wttr.in/${cityname.toLowerCase()}?format=%C+%t`;
    const { data } = await axios.get(url, { responseType: 'text' });
    return `The current weather of ${cityname} is ${data}`;
}

export async function executeCommand(cmd = '') {
    return new Promise((res, rej) => {
        exec(cmd, (error, data) => {
            if (error) {
                return res(`Error running command ${error}`);
            } else {
                res(data);
            }
        });
    });
}

export async function getGithubUserInfoByUsername(username = '') {
    const url = `https://api.github.com/users/${username.toLowerCase()}`;
    const { data } = await axios.get(url);
    return JSON.stringify({
        login: data.login,
        id: data.id,
        name: data.name,
        location: data.location,
        twitter_username: data.twitter_username,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        user_view_type: data.user_view_type,
        followers: data.followers,
        following: data.following,
    });
}

// Tool Map
const TOOL_MAP = {
    getWeatherDetailsByCity: getWeatherDetailsByCity,
    getGithubUserInfoByUsername: getGithubUserInfoByUsername,
    executeCommand: executeCommand,
};

const client = new OpenAI();

console.log(
    chalk.blue(gradient.pastel.multiline(figlet.textSync("Buddy CLI", { horizontalLayout: "full" })))
);

await welcome();
await getTask();

// Functions
async function callAI(USER_PROMPT) {
    const SYSTEM_PROMPT = `
    You are an AI assistant who works on START, THINK and OUTPUT format.
    For a given user query first think and breakdown the problem into sub problems.
    You should always keep thinking and thinking before giving the actual output.

    Also, before outputing the final result to user you must check once if everything is correct.
    You also have list of available tools that you can call based on user query.

    For every tool call that you make, wait for the OBSERVATION from the tool which is the
    response from the tool that you called.

    For code generation always make sure to generate code without adding any unnecessary "" or "\". If possible add comments in the code.

    Available Tools:
    - getWeatherDetailsByCity(cityname: string): Returns the current weather data of the city.
    - getGithubUserInfoByUsername(username: string): Retuns the public info about the github user using github api
    - executeCommand(command: string): Takes a linux / unix command as arg and executes the command on user's machine and returns the output

    Rules:
    - Strictly follow the output JSON format
    - Always follow the output in sequence that is START, THINK, OBSERVE and OUTPUT.
    - Always perform only one step at a time and wait for other step.
    - Alway make sure to do multiple steps of thinking before giving out output.
    - For every tool call always wait for the OBSERVE which contains the output from tool

    Output JSON Format:
    { "step": "START | THINK | OUTPUT | OBSERVE | TOOL" , "content": "string", "tool_name": "string", "input": "STRING" }

    Example:
    User: Hey, can you tell me weather of Patiala?
    ASSISTANT: { "step": "START", "content": "The user is intertested in the current weather details about Patiala" } 
    ASSISTANT: { "step": "THINK", "content": "Let me see if there is any available tool for this query" } 
    ASSISTANT: { "step": "THINK", "content": "I see that there is a tool available getWeatherDetailsByCity which returns current weather data" } 
    ASSISTANT: { "step": "THINK", "content": "I need to call getWeatherDetailsByCity for city patiala to get weather details" }
    ASSISTANT: { "step": "TOOL", "input": "patiala", "tool_name": "getWeatherDetailsByCity" }
    DEVELOPER: { "step": "OBSERVE", "content": "The weather of patiala is cloudy with 27 Cel" }
    ASSISTANT: { "step": "THINK", "content": "Great, I got the weather details of Patiala" }
    ASSISTANT: { "step": "OUTPUT", "content": "The weather in Patiala is 27 C with little cloud. Please make sure to carry an umbrella with you. ☔️" }
    `;

    const messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT,
        },
        {
            role: 'user',
            content: USER_PROMPT,
        },
    ];

    while (true) {
        const response = await client.chat.completions.create({
            model: 'gpt-4.1',
            messages: messages,
        });

        const rawContent = response.choices[0].message.content;
        const parsedContent = JSON.parse(rawContent);

        messages.push({
            role: 'assistant',
            content: JSON.stringify(parsedContent),
        });

        if (parsedContent.step === 'START') {
            console.log(`\t🤖`, parsedContent.content);
            continue;
        }

        if (parsedContent.step === 'THINK') {
            console.log(`\t🤔`, parsedContent.content);
            continue;
        }

        if (parsedContent.step === 'TOOL') {
            const toolToCall = parsedContent.tool_name;
            if (!TOOL_MAP[toolToCall]) {
                messages.push({
                    role: 'developer',
                    content: `There is no such tool as ${toolToCall}`,
                });
                continue;
            }

            const responseFromTool = await TOOL_MAP[toolToCall](parsedContent.input);
            console.log(
                `\t🛠️: ${toolToCall}(${parsedContent.input}) = `,
                responseFromTool
            );
            messages.push({
                role: 'developer',
                content: JSON.stringify({ step: 'OBSERVE', content: responseFromTool }),
            });
            continue;
        }

        if (parsedContent.step === 'OUTPUT') {
            console.log(`\t✅`, parsedContent.content);
            break;
        }
    }
}


async function welcome() {
    const title = chalkAnimation.glitch(
        'Welcome \n'
    );
    await sleep();
    title.stop();
    console.log(`
        ${chalk.green('Click of the specific number to perform the specific tasks.')}
    `);
}

async function getTask() {
    while (true) {
        const answers = await inquirer.prompt({
            name: 'task',
            type: 'list',
            message: 'What do you want to do? \n',
            choices: [
                { name: 'Create a new project 📁', value: 1 },
                { name: 'Add a new feature ⭐', value: 2 },
                { name: 'Fix a bug 🐞', value: 3 },
                { name: 'Tell me the weather 🌤️', value: 4 },
                { name: 'Generate a random joke 😂', value: 5 },
                { name: 'Ask from AI 🤖', value: 6 },
                { name: 'Push to GitHub 🚀', value: 7 },
                { name: 'Exit', value: 8 },
            ]
        });

        switch (answers.task) {
            case 1:
                console.log(chalk.yellow("Feature coming soon!"));
                await getTask();
                break;
            case 2:
                console.log("Feature coming soon!");
                await getTask();
                break;
            case 3:
                const bugDetails = await inquirer.prompt({
                    name: 'bug',
                    type: 'input',
                    message: 'Explain the bug that you want to fix and specify the folder also \n',
                });
                const bugSpinner = createSpinner('Fixing the bug...').start();
                await callAI(`${bugDetails.bug}`);
                bugSpinner.stop();
                await getTask();
                break;
            case 4:
                const city = await inquirer.prompt({
                    name: 'city',
                    type: 'input',
                    message: 'Enter the city name \n',
                });
                const weatherSpinner = createSpinner('Getting weather details...').start();
                await callAI(`Get me the current weather details of ${city.city}`);
                weatherSpinner.stop();
                await getTask();
                break;
            case 5:
                await callAI('Tell me a random joke');
                await getTask();
                break;
            case 6:
                const question = await inquirer.prompt({
                    name: 'question',
                    type: 'input',
                    message: 'Enter your question \n',
                });
                await callAI(`${question.question}`);
                await getTask();
                break;
            case 7:
                const githubDetails = await inquirer.prompt({
                    name: 'github',
                    type: 'input',
                    message: 'Enter your github username, the code folder and repository name where you want to push (make sure the repository is public) \n',
                });
                const githubSpinner = createSpinner('Pushing to GitHub...').start();
                await callAI(`${githubDetails.github}`);
                githubSpinner.stop();
                await getTask();
                break;
            case 8:
                await handleExit();
                return; // Properly exit the loop and program
        }
    }
}

async function handleExit() {
    console.log(
        chalk.blue(
            gradient.pastel.multiline(
                figlet.textSync(
                    "Thank You For Using Buddy.\n Happy Coding",
                    { horizontalLayout: "full" }
                )
            )
        )
    );
}
